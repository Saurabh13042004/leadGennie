from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from email.utils import parsedate_to_datetime
from xml.etree.ElementTree import Element

from defusedxml import ElementTree as ET  # hardened against XML bombs / external entities

from app.sources.html import parse_datetime


@dataclass
class FeedItem:
    title: str
    link: str
    published_at: datetime | None
    summary: str


def _date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        return parse_datetime(value)


def parse_feed(xml_text: str, limit: int = 20) -> list[FeedItem]:
    try:
        root = ET.fromstring(xml_text)
    except Exception:
        return []
    items: list[FeedItem] = []
    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag not in ("item", "entry"):
            continue
        title_el, link_el = _child(el, "title"), _child(el, "link")
        link = ""
        if link_el is not None:
            link = (link_el.get("href") or link_el.text or "").strip()
        # NB: an Element with no children is falsy, so never chain lookups with `or`.
        date_el = next(
            (
                e
                for e in (_child(el, "pubDate"), _child(el, "published"), _child(el, "updated"))
                if e is not None
            ),
            None,
        )
        sum_el = next((e for e in (_child(el, "description"), _child(el, "summary")) if e is not None), None)
        if title_el is not None and title_el.text and link:
            items.append(
                FeedItem(
                    title_el.text.strip(),
                    link,
                    _date(date_el.text if date_el is not None else None),
                    (sum_el.text or "").strip()[:500] if sum_el is not None else "",
                )
            )
        if len(items) >= limit:
            break
    return items


def _child(el: Element, name: str) -> Element | None:
    return next((c for c in el if c.tag.split("}")[-1] == name), None)
