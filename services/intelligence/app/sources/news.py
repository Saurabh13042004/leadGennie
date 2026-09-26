from __future__ import annotations

from app.contracts.common import ErrorCode, SourceType
from app.documents import RawDocument
from app.errors import EngineError
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.sources.base import CollectQuery
from app.sources.fetch import Fetcher
from app.sources.search import SearchHit, SearchProvider, fetch_hits, news_available, usable_hits

_PRESS_HOSTS = ("prnewswire.com", "businesswire.com", "globenewswire.com", "einpresswire.com", "prweb.com")


class NewsCollector:
    name = "news"

    def __init__(
        self, provider: SearchProvider, fetcher: Fetcher, queries: list[str], max_docs: int = 4
    ) -> None:
        self._provider, self._fetcher, self._queries, self._max_docs = provider, fetcher, queries, max_docs

    async def collect(self, ctx: PipelineContext, query: CollectQuery) -> list[RawDocument]:
        if not news_available(self._provider):
            ctx.warn("news_unavailable: no search provider configured")
            return []
        hits: list[SearchHit] = []
        for q in self._queries:
            try:
                hits.extend(await self._provider.news(ctx, q, 8))
            except BudgetExhausted:
                ctx.warn("budget_exhausted:max_search_queries")
                break
            except EngineError as exc:
                ctx.warn(f"news_search_failed:{exc.code}")
                if exc.code == ErrorCode.RATE_LIMITED:
                    break
        chosen = usable_hits(hits, None, ctx.docs.urls(), self._max_docs)
        docs = await fetch_hits(
            ctx, self._fetcher, chosen, SourceType.NEWS, self.name, query.freshness_seconds
        )
        for d in docs:
            if any(h in d.final_url for h in _PRESS_HOSTS):
                d.source_type = SourceType.PRESS_RELEASE
        return docs
