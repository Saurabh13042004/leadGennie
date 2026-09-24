"""HTML → cleaned text, links, metadata. Deterministic; no network."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urldefrag, urljoin, urlparse

from bs4 import BeautifulSoup, Tag

MAX_TEXT_CHARS = 60_000
_DROP_TAGS = (
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "template",
    "canvas",
    "form",
    "button",
    "select",
)
_BOILERPLATE_TAGS = ("nav", "footer", "header", "aside")
_WS = re.compile(r"[ \t ]+")


@dataclass
class ParsedPage:
    title: str | None
    text: str
    links: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    published_at: datetime | None = None


def parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    v = value.strip()
    try:
        dt = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        try:
            dt = datetime.strptime(v[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _meta(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if isinstance(tag, Tag) and tag.get("content"):
            return str(tag["content"]).strip()
    return None


def _jsonld(soup: BeautifulSoup) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tag in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = tag.string or tag.get_text()
        try:
            data = json.loads(raw)
        except (ValueError, TypeError):
            continue
        items = (
            data if isinstance(data, list) else data.get("@graph", [data]) if isinstance(data, dict) else []
        )
        out.extend(i for i in items if isinstance(i, dict))
    return out[:20]


def _links(soup: BeautifulSoup, base_url: str) -> list[str]:
    seen: dict[str, None] = {}
    for a in soup.find_all("a", href=True):
        href = str(a["href"]).strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        absolute, _ = urldefrag(urljoin(base_url, href))
        if urlparse(absolute).scheme in ("http", "https"):
            seen.setdefault(absolute, None)
        if len(seen) >= 300:
            break
    return list(seen)


def _clean_text(root: Tag) -> str:
    lines: list[str] = []
    for raw in root.get_text("\n").splitlines():
        line = _WS.sub(" ", raw).strip()
        if line:
            lines.append(line)
    text = "\n".join(lines)
    return text[:MAX_TEXT_CHARS]


def parse_html(html: str, base_url: str) -> ParsedPage:
    soup = BeautifulSoup(html, "html.parser")
    links = _links(soup, base_url)  # before boilerplate removal: nav/footer links are how we find /careers
    jsonld = _jsonld(soup)

    for tag in soup.find_all(_DROP_TAGS):
        tag.decompose()
    title = _meta(soup, "og:title") or (soup.title.get_text(strip=True) if soup.title else None)

    published = _meta(
        soup, "article:published_time", "og:published_time", "datePublished", "date", "publish_date"
    )
    if not published:
        for item in jsonld:
            if item.get("datePublished"):
                published = str(item["datePublished"])
                break
    if not published:
        time_tag = soup.find("time", attrs={"datetime": True})
        if isinstance(time_tag, Tag):
            published = str(time_tag["datetime"])

    for tag in soup.find_all(_BOILERPLATE_TAGS):
        tag.decompose()
    main = soup.find("main") or soup.find("article") or soup.body or soup
    if isinstance(main, Tag) and len(main.get_text(strip=True)) < 200 and soup.body is not None:
        main = soup.body
    text = _clean_text(main if isinstance(main, Tag) else soup)

    metadata: dict[str, Any] = {
        "description": _meta(soup, "og:description", "description"),
        "site_name": _meta(soup, "og:site_name"),
        "lang": soup.html.get("lang") if soup.html and isinstance(soup.html, Tag) else None,
        "jsonld": jsonld,
    }
    canonical = soup.find("link", attrs={"rel": "canonical"})
    if isinstance(canonical, Tag) and canonical.get("href"):
        metadata["canonical"] = urljoin(base_url, str(canonical["href"]))
    feeds = [
        urljoin(base_url, str(link["href"]))
        for link in soup.find_all("link", attrs={"rel": "alternate"}, href=True)
        if "rss" in str(link.get("type", "")) or "atom" in str(link.get("type", ""))
    ]
    if feeds:
        metadata["feeds"] = feeds[:3]
    return ParsedPage(
        title=title, text=text, links=links, metadata=metadata, published_at=parse_datetime(published)
    )
