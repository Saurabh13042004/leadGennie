from __future__ import annotations

import math
import re
from urllib.parse import urlparse

from app.contracts.common import SourceType
from app.documents import RawDocument
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.sources.base import CollectQuery, registrable_domain, same_site
from app.sources.feeds import parse_feed
from app.sources.fetch import Fetcher, FetchError

# (category, path/text pattern, source type, default paths tried when no link is found)
_CATEGORIES: tuple[tuple[str, re.Pattern[str], SourceType, tuple[str, ...]], ...] = (
    (
        "careers",
        re.compile(r"/(careers?|jobs?|join-us|work-with-us|hiring)(/|$)", re.I),
        SourceType.CAREERS,
        ("/careers", "/jobs"),
    ),
    (
        "about",
        re.compile(r"/(about(-us)?|company|who-we-are|our-story)(/|$)", re.I),
        SourceType.WEBSITE,
        ("/about", "/about-us", "/company"),
    ),
    (
        "team",
        re.compile(r"/(team|leadership|people|management|founders)(/|$)", re.I),
        SourceType.WEBSITE,
        ("/team", "/leadership"),
    ),
    (
        "news",
        re.compile(r"/(news|newsroom|press|media|announcements?)(/|$)", re.I),
        SourceType.PRESS_RELEASE,
        ("/news", "/press", "/newsroom"),
    ),
    ("product", re.compile(r"/(product|platform|solutions?|features)(/|$)", re.I), SourceType.WEBSITE, ()),
    ("pricing", re.compile(r"/pricing(/|$)", re.I), SourceType.WEBSITE, ()),
    ("blog", re.compile(r"/(blog|insights|resources)(/|$)", re.I), SourceType.WEBSITE, ("/blog",)),
)
_SKIP_PATHS = re.compile(
    r"/(privacy|terms|cookie|legal|login|signin|sign-in|signup|sign-up|cdn-cgi|wp-admin)(/|$)", re.I
)
_FILE_EXT = re.compile(r"\.(pdf|png|jpe?g|gif|svg|zip|mp4|css|js|xml)$", re.I)


def website_page_allowance(max_pages: int) -> int:
    """Leave budget for jobs/news/search: the company's own site gets ~40% of pages, at most 8."""
    return max(2, min(8, math.ceil(max_pages * 0.4)))


class WebsiteCollector:
    name = "website"

    def __init__(self, fetcher: Fetcher) -> None:
        self._fetcher = fetcher

    async def collect(self, ctx: PipelineContext, query: CollectQuery) -> list[RawDocument]:
        if not query.domain:
            ctx.warn("no_company_domain: website connector skipped")
            return []
        docs: list[RawDocument] = []
        allowance = website_page_allowance(ctx.request.budgets.max_pages)

        home = await self._fetch_home(ctx, query)
        if home is None:
            ctx.warn(f"website_unreachable:{query.domain}")
            return []
        docs.append(home)

        candidates = self._pick_pages(home, query.domain)
        for url, stype in candidates:
            if len(docs) >= allowance:
                break
            try:
                docs.append(
                    await self._fetcher.fetch_page(
                        ctx,
                        url,
                        source_type=stype,
                        collector=self.name,
                        max_age_seconds=query.freshness_seconds,
                    )
                )
            except FetchError as exc:
                if exc.kind == "robots":
                    ctx.warn(f"robots_disallowed:{urlparse(url).path or '/'}")
            except BudgetExhausted:
                ctx.warn("budget_exhausted:max_pages")
                break
        await self._feed_items(ctx, home, docs, query, allowance)
        return docs

    async def _fetch_home(self, ctx: PipelineContext, query: CollectQuery) -> RawDocument | None:
        assert query.domain
        for url in (f"https://{query.domain}/", f"https://www.{query.domain}/", f"http://{query.domain}/"):
            try:
                return await self._fetcher.fetch_page(
                    ctx,
                    url,
                    source_type=SourceType.WEBSITE,
                    collector=self.name,
                    max_age_seconds=query.freshness_seconds,
                )
            except FetchError:
                continue
        return None

    def _pick_pages(self, home: RawDocument, domain: str) -> list[tuple[str, SourceType]]:
        picked: list[tuple[str, SourceType]] = []
        seen = {home.final_url, home.url}
        links = [
            u
            for u in home.links
            if same_site(u, domain)
            and not _SKIP_PATHS.search(urlparse(u).path)
            and not _FILE_EXT.search(urlparse(u).path)
        ]
        for _cat, pattern, stype, defaults in _CATEGORIES:
            match = next((u for u in links if pattern.search(urlparse(u).path) and u not in seen), None)
            if match:
                picked.append((match, stype))
                seen.add(match)
            else:
                base = f"https://{urlparse(home.final_url).netloc}"
                for path in defaults[:1]:  # try only the most common default per missing category
                    picked.append((base + path, stype))
        return picked

    async def _feed_items(
        self,
        ctx: PipelineContext,
        home: RawDocument,
        docs: list[RawDocument],
        query: CollectQuery,
        allowance: int,
    ) -> None:
        for feed_url in (home.metadata.get("feeds") or [])[:1]:
            if (
                not same_site(feed_url, query.domain or registrable_domain(home.final_url))
                or len(docs) >= allowance
            ):
                continue
            try:
                resp = await self._fetcher.fetch_text(ctx, feed_url)
            except (FetchError, BudgetExhausted):
                continue
            items = parse_feed(resp.body.decode("utf-8", errors="replace"), limit=10)
            for item in items[:2]:
                if len(docs) >= allowance:
                    break
                try:
                    doc = await self._fetcher.fetch_page(
                        ctx,
                        item.link,
                        source_type=SourceType.WEBSITE,
                        collector=self.name,
                        max_age_seconds=query.freshness_seconds,
                    )
                except (FetchError, BudgetExhausted):
                    continue
                if doc.published_at is None and item.published_at is not None:
                    doc.published_at = item.published_at
                docs.append(doc)
