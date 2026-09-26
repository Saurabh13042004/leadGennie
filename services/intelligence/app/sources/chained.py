from __future__ import annotations

from app.contracts.common import ErrorCode
from app.errors import EngineError
from app.pipeline.context import PipelineContext
from app.sources.search import SearchHit, SearchProvider, news_available, web_available


class ChainedSearch:
    """Web search and news from `primary`; when the primary's NEWS call fails (quota, rate limit, outage, bad key) or
    it has no news at all, the same query is answered by `news_fallback` instead. Web search has no fallback: a
    failure there degrades to first-party pages (the collectors already warn and continue).

    A fallback never hides a problem — every switch is recorded as a run warning (`news_fallback:<provider>:<code>`),
    so the result shows which source actually produced the news.
    """

    def __init__(self, primary: SearchProvider, news_fallback: SearchProvider) -> None:
        self._primary, self._fallback = primary, news_fallback
        self.name = f"{primary.name}+{news_fallback.name}"

    @property
    def web_available(self) -> bool:
        return web_available(self._primary)

    @property
    def news_available(self) -> bool:
        return news_available(self._primary) or news_available(self._fallback)

    @property
    def available(self) -> bool:
        return self.web_available or self.news_available

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        if not web_available(self._primary):
            return []
        return await self._primary.search(ctx, query, count)

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        # Per-run circuit breakers, kept as run warnings so no extra state is needed and the result shows them:
        #  - the primary is skipped once it failed for good (quota / bad key): more calls would only waste time
        #  - the fallback is not called again once it failed: a slow/rate-limited fallback must not eat the run's
        #    time budget query after query.
        primary_off = f"news_primary_disabled:{self._primary.name}"
        fallback_off = f"news_fallback_failed:{self._fallback.name}"
        if news_available(self._primary) and primary_off not in ctx.warnings:
            try:
                return await self._primary.news(ctx, query, count)
            except EngineError as exc:
                if exc.code == ErrorCode.VALIDATION:
                    raise  # our own bad request would fail on the fallback too
                ctx.warn(f"news_fallback:{self._primary.name}:{exc.code}")
                if not exc.retryable:
                    ctx.warn(primary_off)
        if fallback_off in ctx.warnings:
            return []
        try:
            return await self._fallback.news(ctx, query, count)
        except EngineError as exc:
            ctx.warn(fallback_off)
            ctx.warn(f"news_fallback_error:{self._fallback.name}:{exc.code}")
            raise
