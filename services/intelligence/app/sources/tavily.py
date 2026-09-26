from __future__ import annotations

from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

import httpx

from app.config import Settings
from app.contracts.common import ErrorCode, UsageItem
from app.errors import EngineError
from app.pipeline.context import PipelineContext
from app.sources.html import parse_datetime
from app.sources.search import SEARCH_COST_USD, SearchHit

_MAX_SNIPPET = 600


def _published(value: object) -> datetime | None:
    """Tavily sends news dates as RFC 2822 (`Tue, 24 Feb 2026 21:14:17 GMT` — seen live), general results as ISO 8601
    or not at all. Anything unparseable is unknown (None), never guessed."""
    text = str(value or "").strip()
    if not text:
        return None
    parsed = parse_datetime(text)
    if parsed is not None:
        return parsed
    try:
        dt = parsedate_to_datetime(text)
    except (TypeError, ValueError):
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


class TavilySearch:
    """Tavily Search API adapter — web (`topic=general`) and news (`topic=news`) from ONE key.

    Free plan: 1,000 credits/month, no card (docs.tavily.com/documentation/api-credits); a `basic` search is 1
    credit. `SearchHit.snippet` is Tavily's relevance-ranked `content`; the engine still fetches and verifies
    every page itself — a provider only DISCOVERS urls, it is never evidence.
    """

    name = "tavily"
    available = True
    _URL = "https://api.tavily.com/search"

    def __init__(self, settings: Settings, client: httpx.AsyncClient | None = None) -> None:
        self._key = settings.tavily_api_key
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0))

    async def _call(self, ctx: PipelineContext, query: str, count: int, topic: str) -> list[SearchHit]:
        ctx.budget.spend_search()
        body: dict[str, object] = {
            "query": query[:400],  # Tavily rejects longer queries
            "topic": topic,
            "search_depth": "basic",  # 1 credit; "advanced" is 2
            "max_results": max(1, min(count, 20)),
            "include_answer": False,
            "include_raw_content": False,
            "include_images": False,
        }
        if topic == "news":
            body["time_range"] = "year"  # a funding round from 3 years ago is not a buying signal
        try:
            resp = await self._client.post(
                self._URL, json=body, headers={"Authorization": f"Bearer {self._key}"}
            )
        except httpx.TimeoutException as exc:
            raise EngineError(ErrorCode.TIMEOUT, "Search provider timed out") from exc
        except httpx.HTTPError as exc:
            raise EngineError(
                ErrorCode.PROVIDER_ERROR, f"Search provider unreachable: {type(exc).__name__}"
            ) from exc

        status = resp.status_code
        if status == 429:
            raise EngineError(ErrorCode.RATE_LIMITED, "Search provider rate limit reached")
        # 432 = the plan's credit limit is used up, 433 = the pay-as-you-go spending cap: neither recovers
        # within this run, so it is a quota problem (not retryable), not a transient one.
        if status in (432, 433):
            raise EngineError(
                ErrorCode.QUOTA_EXCEEDED, "Search provider credit limit reached", retryable=False
            )
        if status in (401, 403):
            raise EngineError(
                ErrorCode.PROVIDER_ERROR, "Search provider rejected the API key", retryable=False
            )
        if status >= 500:
            raise EngineError(ErrorCode.PROVIDER_ERROR, f"Search provider error {status}")
        if status >= 400:
            raise EngineError(
                ErrorCode.PROVIDER_ERROR, f"Search provider rejected the request ({status})", retryable=False
            )
        ctx.add_usage(UsageItem(kind="search", provider="tavily", units=1, cost_estimate=SEARCH_COST_USD))
        try:
            payload = resp.json()
        except ValueError as exc:
            raise EngineError(ErrorCode.PROVIDER_ERROR, "Search provider returned invalid JSON") from exc
        return self._hits(payload.get("results") if isinstance(payload, dict) else None)

    @staticmethod
    def _hits(rows: object) -> list[SearchHit]:
        out: list[SearchHit] = []
        for r in rows if isinstance(rows, list) else []:
            if not isinstance(r, dict) or not isinstance(r.get("url"), str) or not r["url"]:
                continue
            out.append(
                SearchHit(
                    url=r["url"],
                    title=str(r.get("title") or ""),
                    snippet=str(r.get("content") or "")[:_MAX_SNIPPET],
                    published_at=_published(r.get("published_date")),
                )
            )
        return out

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        return await self._call(ctx, query, count, "general")

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        return await self._call(ctx, query, count, "news")
