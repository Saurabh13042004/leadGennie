from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

import httpx

from app.config import Settings
from app.contracts.common import ErrorCode, SourceType, UsageItem
from app.documents import RawDocument
from app.errors import EngineError
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.sources.base import CollectQuery, registrable_domain
from app.sources.fetch import Fetcher, FetchError
from app.sources.html import parse_datetime
from app.telemetry.logging import get_logger

log = get_logger(__name__)

# Never fetched as "evidence": social/profile sites (their ToS bars scraping; profile data enters only via the
# user-initiated extension), search engines, and low-signal aggregators.
BLOCKED_DOMAINS = frozenset(
    {
        "linkedin.com",
        "facebook.com",
        "twitter.com",
        "x.com",
        "instagram.com",
        "tiktok.com",
        "youtube.com",
        "reddit.com",
        "google.com",
        "bing.com",
        "duckduckgo.com",
        "yahoo.com",
        "pinterest.com",
        "quora.com",
        "glassdoor.com",
        "indeed.com",
    }
)
SEARCH_COST_USD = 0.005  # estimate; refine from real invoices (docs/phases/phase-10)


@dataclass
class SearchHit:
    url: str
    title: str
    snippet: str
    published_at: datetime | None = None


class SearchProvider(Protocol):
    # Read-only on purpose: a plain class attribute satisfies this, and so does a provider that COMPUTES it
    # (ChainedSearch is available when its primary or its news fallback is).
    @property
    def name(self) -> str: ...

    @property
    def available(self) -> bool: ...

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]: ...

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]: ...


def web_available(p: SearchProvider) -> bool:
    """Whether `p` can answer WEB search. Providers that only do news set `web_available = False`; every other
    provider is judged by `available` (so plain providers and test fakes keep working unchanged)."""
    return bool(getattr(p, "web_available", p.available))


def news_available(p: SearchProvider) -> bool:
    return bool(getattr(p, "news_available", p.available))


class NullSearch:
    name = "none"
    available = False

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        return []

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        return []


class BraveSearch:
    """Brave Search API adapter. Verify endpoints/terms against Brave's current docs at the first live smoke
    (`make smoke`); response shapes below match the documented web/news search responses."""

    name = "brave"
    available = True
    _BASE = "https://api.search.brave.com/res/v1"

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._key = settings.brave_api_key
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(15.0, connect=5.0))

    async def _call(self, ctx: PipelineContext, path: str, query: str, count: int) -> dict[str, object]:
        ctx.budget.spend_search()
        try:
            resp = await self._client.get(
                f"{self._BASE}/{path}",
                params={"q": query, "count": min(count, 20)},
                headers={"X-Subscription-Token": self._key, "Accept": "application/json"},
            )
        except httpx.TimeoutException as exc:
            raise EngineError(ErrorCode.TIMEOUT, "Search provider timed out") from exc
        except httpx.HTTPError as exc:
            raise EngineError(
                ErrorCode.PROVIDER_ERROR, f"Search provider unreachable: {type(exc).__name__}"
            ) from exc
        ctx.add_usage(UsageItem(kind="search", provider="brave", units=1, cost_estimate=SEARCH_COST_USD))
        if resp.status_code == 429:
            raise EngineError(ErrorCode.RATE_LIMITED, "Search provider rate limit reached")
        if resp.status_code in (401, 403):
            raise EngineError(
                ErrorCode.PROVIDER_ERROR, "Search provider rejected the API key", retryable=False
            )
        if resp.status_code >= 400:
            raise EngineError(ErrorCode.PROVIDER_ERROR, f"Search provider error {resp.status_code}")
        payload: dict[str, object] = resp.json()
        return payload

    @staticmethod
    def _hits(rows: object) -> list[SearchHit]:
        out: list[SearchHit] = []
        for r in rows if isinstance(rows, list) else []:
            if not isinstance(r, dict) or not r.get("url"):
                continue
            out.append(
                SearchHit(
                    url=str(r["url"]),
                    title=str(r.get("title") or ""),
                    snippet=str(r.get("description") or ""),
                    published_at=parse_datetime(str(r.get("page_age") or "") or None),
                )
            )
        return out

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        data = await self._call(ctx, "web/search", query, count)
        web = data.get("web")
        return self._hits(web.get("results") if isinstance(web, dict) else [])

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        data = await self._call(ctx, "news/search", query, count)
        return self._hits(data.get("results"))


def usable_hits(
    hits: list[SearchHit], own_domain: str | None, seen_urls: set[str], limit: int
) -> list[SearchHit]:
    """Filter to pages worth fetching: not blocked, not our own site (website connector covers it), distinct
    registrable domains first."""
    out: list[SearchHit] = []
    used_domains: set[str] = set()
    for h in hits:
        dom = registrable_domain(h.url)
        if dom in BLOCKED_DOMAINS or h.url in seen_urls:
            continue
        if own_domain and dom == registrable_domain(own_domain):
            continue
        if dom in used_domains:
            continue
        used_domains.add(dom)
        out.append(h)
        if len(out) >= limit:
            break
    return out


async def fetch_hits(
    ctx: PipelineContext,
    fetcher: Fetcher,
    hits: list[SearchHit],
    stype: SourceType,
    collector: str,
    freshness: float,
) -> list[RawDocument]:
    docs: list[RawDocument] = []
    for h in hits:
        try:
            doc = await fetcher.fetch_page(
                ctx, h.url, source_type=stype, collector=collector, max_age_seconds=freshness
            )
        except FetchError:
            continue
        except BudgetExhausted:
            ctx.warn("budget_exhausted:max_pages")
            break
        if doc.published_at is None and h.published_at is not None:
            doc.published_at = h.published_at
        doc.metadata.setdefault("search_snippet", h.snippet)
        docs.append(doc)
    return docs


class WebSearchCollector:
    name = "web_search"

    def __init__(
        self, provider: SearchProvider, fetcher: Fetcher, queries: list[str], max_docs: int = 5
    ) -> None:
        self._provider, self._fetcher, self._queries, self._max_docs = provider, fetcher, queries, max_docs

    async def collect(self, ctx: PipelineContext, query: CollectQuery) -> list[RawDocument]:
        if not web_available(self._provider):
            ctx.warn("web_search_unavailable: no search provider configured")
            return []
        hits: list[SearchHit] = []
        for q in self._queries:
            try:
                hits.extend(await self._provider.search(ctx, q, 8))
            except BudgetExhausted:
                ctx.warn("budget_exhausted:max_search_queries")
                break
            except EngineError as exc:
                ctx.warn(f"web_search_failed:{exc.code}")
                if exc.code == ErrorCode.RATE_LIMITED:
                    break
        chosen = usable_hits(hits, query.domain, ctx.docs.urls(), self._max_docs)
        return await fetch_hits(
            ctx, self._fetcher, chosen, SourceType.SEARCH, self.name, query.freshness_seconds
        )
