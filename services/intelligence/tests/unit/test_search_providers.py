"""Tavily / GDELT / chaining / registry — all HTTP mocked (no network, no keys)."""

from __future__ import annotations

import asyncio
import json

import httpx
import pytest
from app.config import Settings
from app.contracts.common import ErrorCode
from app.errors import EngineError
from app.pipeline.context import BudgetExhausted
from app.sources.chained import ChainedSearch
from app.sources.gdelt import GdeltNews
from app.sources.news import NewsCollector
from app.sources.registry import build_search, describe_search
from app.sources.search import (
    BraveSearch,
    NullSearch,
    SearchHit,
    SearchProvider,
    WebSearchCollector,
    news_available,
    web_available,
)
from app.sources.tavily import TavilySearch

from tests.helpers import make_ctx, make_settings
from tests.unit.test_collectors import QUERY, fetcher


def tavily(handler) -> TavilySearch:  # type: ignore[no-untyped-def]
    return TavilySearch(
        make_settings(tavily_api_key="tvly-k", search_provider="tavily"),
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


# --------------------------------------------------------------------------------------------- Tavily


async def test_tavily_web_and_news_requests_and_parsing() -> None:
    seen: list[dict[str, object]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["authorization"] == "Bearer tvly-k"
        body = json.loads(req.content)
        seen.append(body)
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "title": "Acme raises Series B",
                        "url": "https://news.example/acme",
                        "content": "x" * 900,
                        "published_date": "2026-09-01T10:00:00Z",
                    },
                    {"title": "no url"},  # malformed rows are skipped, not fatal
                    {"url": "", "title": "empty url"},
                    "garbage",
                ]
            },
        )

    ctx, t = make_ctx(), tavily(handler)
    web = await t.search(ctx, "acme", 5)
    news = await t.news(ctx, "acme funding", 5)

    assert [h.url for h in web] == ["https://news.example/acme"]
    assert web[0].published_at is not None and web[0].published_at.year == 2026
    assert len(web[0].snippet) == 600  # snippets are capped
    assert news[0].title == "Acme raises Series B"
    # web = general topic; news = news topic limited to the last year. Cheapest depth, no extras that cost credits.
    assert seen[0]["topic"] == "general" and "time_range" not in seen[0]
    assert seen[1]["topic"] == "news" and seen[1]["time_range"] == "year"
    for body in seen:
        assert body["search_depth"] == "basic"
        assert body["include_answer"] is False and body["include_raw_content"] is False
    assert [u.provider for u in ctx.usage] == ["tavily", "tavily"] and ctx.budget.searches == 2


@pytest.mark.parametrize(
    "raw,expected",
    [
        (
            "Tue, 24 Feb 2026 21:14:17 GMT",
            (2026, 2, 24, 21),
        ),  # what Tavily's news topic really returns (seen live)
        ("2026-09-01T10:00:00Z", (2026, 9, 1, 10)),
        ("2026-09-01", (2026, 9, 1, 0)),
        ("Wed, 15 Jul 2026 19:00:05 +0530", (2026, 7, 15, 19)),  # non-UTC offsets keep their tzinfo
    ],
)
async def test_tavily_parses_the_date_formats_it_really_sends(
    raw: str, expected: tuple[int, int, int, int]
) -> None:
    t = tavily(
        lambda _r: httpx.Response(
            200, json={"results": [{"url": "https://n.example/a", "title": "t", "published_date": raw}]}
        )
    )
    hit = (await t.news(make_ctx(), "acme", 5))[0]
    assert hit.published_at is not None and hit.published_at.tzinfo is not None
    assert (
        hit.published_at.year,
        hit.published_at.month,
        hit.published_at.day,
        hit.published_at.hour,
    ) == expected


@pytest.mark.parametrize("raw", [None, "", "yesterday", "not a date", 12345])
async def test_tavily_unparseable_dates_are_unknown_never_invented(raw: object) -> None:
    t = tavily(
        lambda _r: httpx.Response(
            200, json={"results": [{"url": "https://n.example/a", "title": "t", "published_date": raw}]}
        )
    )
    assert (await t.news(make_ctx(), "acme", 5))[0].published_at is None


async def test_tavily_clamps_query_and_result_count() -> None:
    seen: list[dict[str, object]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(json.loads(req.content))
        return httpx.Response(200, json={"results": []})

    t = tavily(handler)
    await t.search(make_ctx(), "q" * 1000, 500)
    await t.search(make_ctx(), "q", 0)
    assert len(str(seen[0]["query"])) == 400 and seen[0]["max_results"] == 20
    assert seen[1]["max_results"] == 1


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (429, ErrorCode.RATE_LIMITED, True),
        (432, ErrorCode.QUOTA_EXCEEDED, False),  # plan credits used up
        (433, ErrorCode.QUOTA_EXCEEDED, False),  # pay-as-you-go cap
        (401, ErrorCode.PROVIDER_ERROR, False),
        (403, ErrorCode.PROVIDER_ERROR, False),
        (400, ErrorCode.PROVIDER_ERROR, False),
        (500, ErrorCode.PROVIDER_ERROR, True),
        (503, ErrorCode.PROVIDER_ERROR, True),
    ],
)
async def test_tavily_errors_map_to_contract_codes_and_spend_no_credit(
    status: int, code: ErrorCode, retryable: bool
) -> None:
    ctx = make_ctx()
    with pytest.raises(EngineError) as exc:
        await tavily(lambda _r: httpx.Response(status)).search(ctx, "x", 3)
    assert exc.value.code == code and exc.value.retryable is retryable
    assert ctx.usage == []  # a failed call is not metered as spend


async def test_tavily_timeout_network_and_bad_json() -> None:
    def boom(_r: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    def down(_r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("no route")

    with pytest.raises(EngineError) as t:
        await tavily(boom).search(make_ctx(), "x", 3)
    assert t.value.code == ErrorCode.TIMEOUT
    with pytest.raises(EngineError) as n:
        await tavily(down).search(make_ctx(), "x", 3)
    assert n.value.code == ErrorCode.PROVIDER_ERROR and n.value.retryable
    with pytest.raises(EngineError) as j:
        await tavily(lambda _r: httpx.Response(200, text="<html>oops</html>")).search(make_ctx(), "x", 3)
    assert j.value.code == ErrorCode.PROVIDER_ERROR


async def test_tavily_respects_the_hard_search_budget() -> None:
    t = tavily(lambda _r: httpx.Response(200, json={"results": []}))
    ctx = make_ctx(max_search_queries=1)
    await t.search(ctx, "one", 3)
    with pytest.raises(BudgetExhausted):
        await t.news(ctx, "two", 3)


# ---------------------------------------------------------------------------------------------- GDELT


class Clock:
    """Deterministic time for the throttle: `sleep` advances `now`, so tests take no real time."""

    def __init__(self) -> None:
        self.now = 1000.0
        self.slept: list[float] = []

    def monotonic(self) -> float:
        return self.now

    async def sleep(self, seconds: float) -> None:
        self.slept.append(seconds)
        self.now += seconds


def gdelt(handler, clock: Clock | None = None, **settings) -> GdeltNews:  # type: ignore[no-untyped-def]
    c = clock or Clock()
    return GdeltNews(
        make_settings(**settings),
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        sleep=c.sleep,
        monotonic=c.monotonic,
    )


ARTICLES = {
    "articles": [
        {
            "url": "https://news.example/a",
            "title": "Acme raises $20M",
            "seendate": "20260901T101500Z",
            "domain": "news.example",
        },
        {"url": "https://news.example/a", "title": "duplicate url"},
        {"url": "ftp://bad.example/x", "title": "not http"},
        {"url": "https://other.example/b", "title": "Acme opens Bengaluru office", "seendate": "garbage"},
        {"title": "no url"},
    ]
}


async def test_gdelt_parses_articles_dedupes_and_records_free_usage() -> None:
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json=ARTICLES)

    ctx = make_ctx()
    hits = await gdelt(handler).news(ctx, '"Acme" funding', 8)

    assert [h.url for h in hits] == ["https://news.example/a", "https://other.example/b"]
    assert hits[0].published_at is not None and (hits[0].published_at.year, hits[0].published_at.hour) == (
        2026,
        10,
    )
    assert hits[1].published_at is None  # an unparseable date is unknown, never invented
    assert hits[0].snippet == ""  # GDELT gives no snippet; we don't make one up
    params = dict(seen[0].url.params)
    assert params["mode"] == "artlist" and params["format"] == "json" and params["sort"] == "datedesc"
    assert params["query"] == '"Acme" funding sourcelang:english'
    assert ctx.usage[0].provider == "gdelt" and ctx.usage[0].cost_estimate == 0.0


async def test_gdelt_language_can_be_disabled() -> None:
    seen: list[httpx.Request] = []

    def handler(req: httpx.Request) -> httpx.Response:
        seen.append(req)
        return httpx.Response(200, json={"articles": []})

    await gdelt(handler, gdelt_language="").news(make_ctx(), "acme", 5)
    assert dict(seen[0].url.params)["query"] == "acme"


async def test_gdelt_is_news_only() -> None:
    def never(_r: httpx.Request) -> httpx.Response:
        raise AssertionError("web search must not call GDELT")

    g = gdelt(never)
    assert await g.search(make_ctx(), "acme", 5) == []
    assert web_available(g) is False and news_available(g) is True


async def test_gdelt_plain_text_answer_to_a_bad_query_is_an_empty_result_not_an_error() -> None:
    hits = await gdelt(lambda _r: httpx.Response(200, text="The specified phrase is too short.")).news(
        make_ctx(), "a", 5
    )
    assert hits == []


@pytest.mark.parametrize(
    "response",
    [httpx.Response(429), httpx.Response(200, text="Please limit requests to one every 5 seconds.")],
)
async def test_gdelt_rate_limit_is_recognised_either_way(response: httpx.Response) -> None:
    with pytest.raises(EngineError) as exc:
        await gdelt(lambda _r: response).news(make_ctx(), "acme", 5)
    assert exc.value.code == ErrorCode.RATE_LIMITED and exc.value.retryable


async def test_gdelt_server_and_client_errors() -> None:
    with pytest.raises(EngineError) as e5:
        await gdelt(lambda _r: httpx.Response(503)).news(make_ctx(), "acme", 5)
    assert e5.value.code == ErrorCode.PROVIDER_ERROR and e5.value.retryable
    with pytest.raises(EngineError) as e4:
        await gdelt(lambda _r: httpx.Response(400, text="bad")).news(make_ctx(), "acme", 5)
    assert e4.value.code == ErrorCode.PROVIDER_ERROR and not e4.value.retryable


async def test_gdelt_spaces_calls_to_respect_one_request_per_five_seconds() -> None:
    clock = Clock()
    g = gdelt(lambda _r: httpx.Response(200, json={"articles": []}), clock)
    await g.news(make_ctx(), "one", 5)
    assert clock.slept == []  # the first call never waits
    await g.news(make_ctx(), "two", 5)
    assert clock.slept == [5.5]  # immediately after → wait the full interval
    clock.now += 60
    await g.news(make_ctx(), "three", 5)
    assert clock.slept == [5.5]  # plenty of time passed → no wait


async def test_gdelt_serializes_concurrent_callers() -> None:
    clock = Clock()
    in_flight = 0
    peak = 0

    async def slow(_r: httpx.Request) -> httpx.Response:
        nonlocal in_flight, peak
        in_flight += 1
        peak = max(peak, in_flight)
        await asyncio.sleep(0)  # let the other caller try to run
        in_flight -= 1
        return httpx.Response(200, json={"articles": []})

    g = GdeltNews(
        make_settings(),
        httpx.AsyncClient(transport=httpx.MockTransport(slow)),
        sleep=clock.sleep,
        monotonic=clock.monotonic,
    )
    await asyncio.gather(*(g.news(make_ctx(), f"q{i}", 5) for i in range(3)))
    assert peak == 1 and len(clock.slept) == 2


# ------------------------------------------------------------------------------------------- Chaining


class Scripted:
    """A provider whose answers are scripted; records which calls it received."""

    def __init__(
        self, name: str, *, web: bool = True, news: bool = True, error: EngineError | Exception | None = None
    ) -> None:
        self.name = name
        self.web_available, self.news_available = web, news
        self.available = web or news
        self.error = error
        self.calls: list[str] = []

    async def search(self, ctx, query, count):  # type: ignore[no-untyped-def]
        self.calls.append(f"search:{query}")
        if self.error:
            raise self.error
        return [SearchHit(f"https://{self.name}.example/web", "w", "")]

    async def news(self, ctx, query, count):  # type: ignore[no-untyped-def]
        self.calls.append(f"news:{query}")
        if self.error:
            raise self.error
        return [SearchHit(f"https://{self.name}.example/news", "n", "")]


async def test_chained_uses_primary_for_both_and_never_touches_the_fallback_when_it_works() -> None:
    primary, fallback = Scripted("tavily"), Scripted("gdelt", web=False)
    chain, ctx = ChainedSearch(primary, fallback), make_ctx()
    assert (await chain.search(ctx, "q", 5))[0].url == "https://tavily.example/web"
    assert (await chain.news(ctx, "q", 5))[0].url == "https://tavily.example/news"
    assert fallback.calls == [] and ctx.warnings == []


@pytest.mark.parametrize(
    "code", [ErrorCode.QUOTA_EXCEEDED, ErrorCode.RATE_LIMITED, ErrorCode.PROVIDER_ERROR, ErrorCode.TIMEOUT]
)
async def test_chained_falls_back_for_news_and_says_so(code: ErrorCode) -> None:
    primary = Scripted("tavily", error=EngineError(code, "primary down"))
    fallback = Scripted("gdelt", web=False)
    ctx = make_ctx()
    hits = await ChainedSearch(primary, fallback).news(ctx, "acme funding", 5)
    assert hits[0].url == "https://gdelt.example/news"
    assert f"news_fallback:tavily:{code}" in ctx.warnings  # the switch is visible in the run result


async def test_chained_stops_calling_a_primary_that_failed_for_good_within_the_run() -> None:
    primary = Scripted(
        "tavily", error=EngineError(ErrorCode.QUOTA_EXCEEDED, "credits used up", retryable=False)
    )
    fallback = Scripted("gdelt", web=False)
    chain, ctx = ChainedSearch(primary, fallback), make_ctx()
    for q in ("funding", "expansion", "leadership"):
        assert await chain.news(ctx, q, 5)
    assert primary.calls == ["news:funding"]  # one wasted call, not three
    assert fallback.calls == ["news:funding", "news:expansion", "news:leadership"]
    assert "news_primary_disabled:tavily" in ctx.warnings


async def test_chained_keeps_retrying_a_primary_that_only_hit_a_transient_error() -> None:
    primary = Scripted("tavily", error=EngineError(ErrorCode.PROVIDER_ERROR, "502"))  # retryable
    chain, ctx = ChainedSearch(primary, Scripted("gdelt", web=False)), make_ctx()
    await chain.news(ctx, "a", 5)
    await chain.news(ctx, "b", 5)
    assert primary.calls == ["news:a", "news:b"]
    assert "news_primary_disabled:tavily" not in ctx.warnings


async def test_chained_gives_up_on_a_failing_fallback_for_the_rest_of_the_run() -> None:
    """GDELT measured 16-20 s just to refuse: it must not be asked again for every remaining query."""
    fallback = Scripted("gdelt", web=False, error=EngineError(ErrorCode.RATE_LIMITED, "limit"))
    chain, ctx = ChainedSearch(NullSearch(), fallback), make_ctx()
    with pytest.raises(EngineError):
        await chain.news(ctx, "first", 5)
    assert await chain.news(ctx, "second", 5) == []  # silently skipped, no wait
    assert await chain.news(ctx, "third", 5) == []
    assert fallback.calls == ["news:first"]
    assert (
        "news_fallback_failed:gdelt" in ctx.warnings
        and "news_fallback_error:gdelt:RATE_LIMITED" in ctx.warnings
    )


async def test_the_breakers_are_per_run_not_global() -> None:
    fallback = Scripted("gdelt", web=False, error=EngineError(ErrorCode.RATE_LIMITED, "limit"))
    chain = ChainedSearch(NullSearch(), fallback)
    with pytest.raises(EngineError):
        await chain.news(make_ctx(), "run1", 5)
    with pytest.raises(EngineError):  # a NEW run gets a fresh attempt
        await chain.news(make_ctx(), "run2", 5)
    assert fallback.calls == ["news:run1", "news:run2"]


async def test_chained_does_not_mask_our_own_bad_requests_or_the_budget() -> None:
    fallback = Scripted("gdelt", web=False)
    with pytest.raises(EngineError):
        await ChainedSearch(
            Scripted("tavily", error=EngineError(ErrorCode.VALIDATION, "bad")), fallback
        ).news(make_ctx(), "q", 5)
    with pytest.raises(BudgetExhausted):
        await ChainedSearch(Scripted("tavily", error=BudgetExhausted("max_search_queries")), fallback).news(
            make_ctx(), "q", 5
        )
    assert fallback.calls == []


async def test_chained_has_no_web_fallback_a_failure_propagates_to_the_collector() -> None:
    chain = ChainedSearch(
        Scripted("tavily", error=EngineError(ErrorCode.QUOTA_EXCEEDED, "out")), Scripted("gdelt", web=False)
    )
    with pytest.raises(EngineError):
        await chain.search(make_ctx(), "q", 5)


async def test_chained_with_no_primary_is_news_only_via_the_fallback() -> None:
    fallback = Scripted("gdelt", web=False)
    chain = ChainedSearch(NullSearch(), fallback)
    assert (web_available(chain), news_available(chain), chain.available) == (False, True, True)
    assert await chain.search(make_ctx(), "q", 5) == []
    assert (await chain.news(make_ctx(), "q", 5))[0].url == "https://gdelt.example/news"
    assert chain.name == "none+gdelt"


async def test_collectors_report_what_is_actually_missing() -> None:
    """News-only stack: news works with no warning, web search warns — the run says exactly what it lacked."""
    from tests.helpers import html

    chain = ChainedSearch(NullSearch(), Scripted("gdelt", web=False))
    f = fetcher(
        {
            "https://gdelt.example/robots.txt": httpx.Response(404),
            "https://gdelt.example/news": html(
                "<main><h1>Acme raises</h1><p>Acme announced a new funding round today.</p></main>"
            ),
        }
    )
    ctx = make_ctx()
    news = await NewsCollector(chain, f, ["q"]).collect(ctx, QUERY)
    web = await WebSearchCollector(chain, f, ["q"]).collect(ctx, QUERY)
    assert len(news) == 1 and web == []
    assert any(w.startswith("web_search_unavailable") for w in ctx.warnings)
    assert not any(w.startswith("news_unavailable") for w in ctx.warnings)


# ------------------------------------------------------------------------------------------- Registry


def kinds(p: SearchProvider) -> tuple[str, ...]:
    return tuple(
        type(x).__name__
        for x in (p, getattr(p, "_primary", None), getattr(p, "_fallback", None))
        if x is not None
    )


def settings(**kw: object) -> Settings:
    return make_settings(**kw)


def test_build_search_picks_the_configured_provider() -> None:
    assert isinstance(build_search(settings()), NullSearch)
    assert isinstance(build_search(settings(search_provider="tavily", tavily_api_key="k")), TavilySearch)
    assert isinstance(build_search(settings(search_provider="brave", brave_api_key="k")), BraveSearch)
    # a provider without its key is not "configured": never a half-built client
    assert isinstance(build_search(settings(search_provider="tavily")), NullSearch)
    assert isinstance(build_search(settings(search_provider="brave")), NullSearch)


def test_build_search_wraps_with_the_gdelt_fallback_only_when_asked() -> None:
    assert kinds(
        build_search(settings(search_provider="tavily", tavily_api_key="k", news_fallback="gdelt"))
    ) == (
        "ChainedSearch",
        "TavilySearch",
        "GdeltNews",
    )
    assert kinds(build_search(settings(news_fallback="gdelt"))) == (
        "ChainedSearch",
        "NullSearch",
        "GdeltNews",
    )
    assert kinds(build_search(settings(search_provider="tavily", tavily_api_key="k"))) == ("TavilySearch",)


@pytest.mark.parametrize(
    "kw,expected",
    [
        ({}, "no search provider (website+jobs only)"),
        ({"search_provider": "tavily", "tavily_api_key": "k"}, "ok"),
        (
            {"search_provider": "tavily", "tavily_api_key": "k", "news_fallback": "gdelt"},
            "ok (tavily (web+news); news fallback: gdelt)",
        ),
        ({"search_provider": "tavily"}, "SEARCH_PROVIDER=tavily but its API key is not set"),
        ({"news_fallback": "gdelt"}, "news only (gdelt, no web search)"),
    ],
)
def test_describe_search_says_what_the_engine_will_have(kw: dict[str, object], expected: str) -> None:
    assert describe_search(settings(**kw)) == expected


def test_defaults_are_off_no_third_party_is_called_unless_opted_in() -> None:
    s = Settings(_env_file=None)  # type: ignore[call-arg]
    assert s.search_provider == "none" and s.news_fallback == "none" and s.tavily_api_key == ""
