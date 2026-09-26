from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime

import httpx

from app.config import Settings
from app.contracts.common import ErrorCode, UsageItem
from app.errors import EngineError
from app.pipeline.context import PipelineContext
from app.sources.search import SearchHit
from app.telemetry.logging import get_logger

log = get_logger(__name__)


def _seen(value: object) -> datetime | None:
    try:
        return datetime.strptime(str(value), "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)
    except ValueError:
        return None


class GdeltNews:
    """GDELT DOC 2.0 news search — free, NO API key. News only (it is not a web search engine).

    GDELT indexes a rolling ~3 months of worldwide news and returns article url + title + date (no snippet).
    It asks for at most one request every 5 seconds per IP, so calls are serialized and spaced here. Measured live
    (2026-09-26): a simple query took ~14 s, and after the first success every further request was refused with a
    429 — even 12-27 s apart. Treat it as a BEST-EFFORT keyless fallback for `news`, never the primary source;
    ChainedSearch stops calling it for the rest of a run after its first failure. Coverage of small companies is
    thin and noisy: the Evidence Validator still verifies every claim against the fetched page.
    """

    name = "gdelt"
    available = True
    web_available = False
    news_available = True
    _URL = "https://api.gdeltproject.org/api/v2/doc/doc"

    def __init__(
        self,
        settings: Settings,
        client: httpx.AsyncClient | None = None,
        *,
        min_interval: float = 5.5,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
        monotonic: Callable[[], float] = time.monotonic,
    ) -> None:
        self._language = settings.gdelt_language.strip()
        self._client = client or httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0))
        self._min_interval, self._sleep, self._now = min_interval, sleep, monotonic
        self._gate = asyncio.Lock()
        self._last_call: float | None = None

    async def _throttle(self) -> None:
        if self._last_call is not None:
            wait = self._min_interval - (self._now() - self._last_call)
            if wait > 0:
                await self._sleep(wait)
        self._last_call = self._now()

    async def search(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        return []  # not a web search engine

    async def news(self, ctx: PipelineContext, query: str, count: int) -> list[SearchHit]:
        ctx.budget.spend_search()
        q = f"{query} sourcelang:{self._language}" if self._language else query
        params = {
            "query": q[:500],
            "mode": "artlist",
            "format": "json",
            "sort": "datedesc",
            "maxrecords": str(max(1, min(count, 50))),
        }
        async with self._gate:  # one request at a time, spaced
            await self._throttle()
            try:
                resp = await self._client.get(self._URL, params=params)
            except httpx.TimeoutException as exc:
                raise EngineError(ErrorCode.TIMEOUT, "News provider timed out") from exc
            except httpx.HTTPError as exc:
                raise EngineError(
                    ErrorCode.PROVIDER_ERROR, f"News provider unreachable: {type(exc).__name__}"
                ) from exc

        if resp.status_code == 429 or "limit requests" in resp.text[:200].lower():
            raise EngineError(ErrorCode.RATE_LIMITED, "News provider rate limit reached")
        if resp.status_code >= 500:
            raise EngineError(ErrorCode.PROVIDER_ERROR, f"News provider error {resp.status_code}")
        if resp.status_code >= 400:
            raise EngineError(
                ErrorCode.PROVIDER_ERROR,
                f"News provider rejected the request ({resp.status_code})",
                retryable=False,
            )
        ctx.add_usage(UsageItem(kind="search", provider="gdelt", units=1, cost_estimate=0.0))
        try:
            payload = resp.json()
        except ValueError:
            # GDELT answers a bad/too-short query with a plain-text 200 ("The specified phrase is too short.").
            log.info("gdelt.non_json_response", body=resp.text[:120])
            return []
        rows = payload.get("articles") if isinstance(payload, dict) else None
        out: list[SearchHit] = []
        seen: set[str] = set()
        for r in rows if isinstance(rows, list) else []:
            url = r.get("url") if isinstance(r, dict) else None
            if not isinstance(url, str) or not url.startswith(("http://", "https://")) or url in seen:
                continue
            seen.add(url)
            out.append(
                SearchHit(
                    url=url,
                    title=str(r.get("title") or ""),
                    snippet="",
                    published_at=_seen(r.get("seendate")),
                )
            )
        return out
