import httpx
import pytest
from app.config import Settings
from app.contracts.common import ErrorCode, SourceType
from app.errors import EngineError
from app.pipeline.planner import news_queries, plan_queries, web_queries
from app.sources.base import CollectQuery, registrable_domain
from app.sources.feeds import parse_feed
from app.sources.fetch import Fetcher
from app.sources.jobs import JobsCollector, api_url, detect_boards, parse_board
from app.sources.news import NewsCollector
from app.sources.search import BraveSearch, NullSearch, SearchHit, WebSearchCollector, usable_hits
from app.sources.website import WebsiteCollector
from app.store.memory import MemoryHostLimiter, MemorySourceCache

from tests.helpers import FakeResolver, fixture, html, make_ctx, make_settings, site_transport

QUERY = CollectQuery(company_name="Acme", domain="acme.example", offer_keywords=("outbound",))
ACME = {
    "https://acme.example/robots.txt": httpx.Response(404),
    "https://acme.example/": html(fixture("acme_home.html")),
    "https://acme.example/about": html(fixture("acme_about.html")),
    "https://acme.example/careers": html(fixture("acme_careers.html")),
    "https://acme.example/news": html(fixture("acme_news.html")),
    "https://acme.example/pricing": html(
        "<main><h1>Pricing</h1><p>Plans start at $99 per seat per month for teams.</p></main>"
    ),
    "https://acme.example/blog/feed.xml": httpx.Response(
        200,
        text="""<?xml version="1.0"?><rss><channel>
      <item><title>Launching Acme Sequences</title><link>https://acme.example/blog/sequences</link><pubDate>Tue, 08 Sep 2026 10:00:00 GMT</pubDate></item>
      </channel></rss>""",
        headers={"content-type": "application/rss+xml"},
    ),
    "https://acme.example/blog/sequences": html(
        "<main><h1>Launching Acme Sequences</h1><p>Today we launch Sequences, a new product.</p></main>"
    ),
}


def fetcher(routes: dict, *, settings: Settings | None = None):  # type: ignore[type-arg,no-untyped-def]
    client = httpx.AsyncClient(transport=site_transport(routes), follow_redirects=False)
    return Fetcher(
        settings or make_settings(),
        MemoryHostLimiter(),
        MemorySourceCache(),
        client=client,
        resolver=FakeResolver(),
    )


async def test_website_collector_finds_key_pages_from_nav_and_types_them() -> None:
    ctx = make_ctx(max_pages=25)
    docs = await WebsiteCollector(fetcher(ACME)).collect(ctx, QUERY)
    by_url = {d.url: d for d in docs}
    assert {
        "https://acme.example/",
        "https://acme.example/about",
        "https://acme.example/careers",
        "https://acme.example/news",
    } <= set(by_url)
    assert by_url["https://acme.example/careers"].source_type == SourceType.CAREERS
    assert by_url["https://acme.example/news"].source_type == SourceType.PRESS_RELEASE
    assert all(u in ctx.docs for u in by_url)
    assert not any("twitter.com" in u for u in by_url)  # off-site links are never followed


async def test_website_collector_respects_page_allowance_and_reports_unreachable() -> None:
    ctx = make_ctx(max_pages=5)  # allowance = max(2, ceil(2.0)) = 2
    docs = await WebsiteCollector(fetcher(ACME)).collect(ctx, QUERY)
    assert len(docs) <= 2
    ctx2 = make_ctx()
    assert (
        await WebsiteCollector(fetcher({"https://acme.example/robots.txt": httpx.Response(404)})).collect(
            ctx2, QUERY
        )
        == []
    )
    assert "website_unreachable:acme.example" in ctx2.warnings
    ctx3 = make_ctx()
    assert await WebsiteCollector(fetcher({})).collect(ctx3, CollectQuery("Acme", None)) == []
    assert any(w.startswith("no_company_domain") for w in ctx3.warnings)


async def test_website_collector_reads_blog_feed_items() -> None:
    docs = await WebsiteCollector(fetcher(ACME)).collect(make_ctx(max_pages=40), QUERY)
    launch = next(d for d in docs if d.url == "https://acme.example/blog/sequences")
    assert launch.published_at is not None and launch.published_at.date().isoformat() == "2026-09-08"


def test_detect_ats_boards_and_parse_shapes() -> None:
    links = [
        "https://boards.greenhouse.io/acme",
        "https://jobs.lever.co/acme-co",
        "https://jobs.ashbyhq.com/acme",
        "https://example.com/x",
        "https://boards.greenhouse.io/acme/jobs/123",
    ]
    assert detect_boards(links) == [
        ("greenhouse", "acme", "https://boards.greenhouse.io/acme"),
        ("lever", "acme-co", "https://jobs.lever.co/acme-co"),
        ("ashby", "acme", "https://jobs.ashbyhq.com/acme"),
    ]
    gh = parse_board(
        "greenhouse",
        {
            "jobs": [
                {
                    "title": "SDR",
                    "location": {"name": "Bengaluru"},
                    "absolute_url": "u",
                    "updated_at": "2026-09-01",
                }
            ]
        },
    )
    assert gh == [
        {"title": "SDR", "location": "Bengaluru", "department": None, "posted_at": "2026-09-01", "url": "u"}
    ]
    lever = parse_board(
        "lever", [{"text": "AE", "categories": {"location": "Austin", "team": "Sales"}, "hostedUrl": "u"}]
    )
    assert lever[0]["department"] == "Sales"
    assert (
        parse_board("ashby", {"jobs": [{"title": "Eng", "location": "Remote", "jobUrl": "u"}]})[0]["title"]
        == "Eng"
    )
    assert parse_board("greenhouse", "garbage") == [] and parse_board("nope-ats", {}) == []


async def test_jobs_collector_builds_a_document_from_the_public_board_api() -> None:
    board = {
        "jobs": [
            {
                "title": "Sales Development Representative",
                "location": {"name": "Bengaluru"},
                "absolute_url": "https://boards.greenhouse.io/acme/jobs/1",
            },
            {
                "title": "Sales Development Representative",
                "location": {"name": "Austin"},
                "absolute_url": "https://boards.greenhouse.io/acme/jobs/2",
            },
        ]
    }
    routes = {**ACME, api_url("greenhouse", "acme"): httpx.Response(200, json=board)}
    ctx = make_ctx()
    f = fetcher(routes)
    await WebsiteCollector(f).collect(ctx, QUERY)  # careers page links to the Greenhouse board
    docs = await JobsCollector(f).collect(ctx, QUERY)
    assert len(docs) == 1 and docs[0].source_type == SourceType.JOBS_BOARD
    assert docs[0].url in ctx.docs and len(docs[0].metadata["jobs"]) == 2
    assert "Sales Development Representative — Bengaluru" in docs[0].text


def brave(handler) -> BraveSearch:  # type: ignore[no-untyped-def]
    return BraveSearch(
        make_settings(brave_api_key="k", search_provider="brave"),
        httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )


async def test_brave_adapter_parses_web_and_news_and_records_usage() -> None:
    def handler(req: httpx.Request) -> httpx.Response:
        assert req.headers["x-subscription-token"] == "k"
        if "news/search" in str(req.url):
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "title": "Acme raises",
                            "url": "https://news.example/a",
                            "description": "d",
                            "page_age": "2026-09-01T10:00:00",
                        }
                    ]
                },
            )
        return httpx.Response(
            200,
            json={
                "web": {
                    "results": [{"title": "Acme", "url": "https://blog.example/acme", "description": "x"}]
                }
            },
        )

    ctx = make_ctx()
    b = brave(handler)
    web, news = await b.search(ctx, "acme", 5), await b.news(ctx, "acme", 5)
    assert web[0].url == "https://blog.example/acme" and news[0].published_at is not None
    assert [u.kind for u in ctx.usage] == ["search", "search"] and ctx.budget.searches == 2


@pytest.mark.parametrize(
    "status,code,retryable",
    [
        (429, ErrorCode.RATE_LIMITED, True),
        (401, ErrorCode.PROVIDER_ERROR, False),
        (500, ErrorCode.PROVIDER_ERROR, True),
    ],
)
async def test_brave_errors_map_to_contract_codes(status: int, code: ErrorCode, retryable: bool) -> None:
    with pytest.raises(EngineError) as exc:
        await brave(lambda _r: httpx.Response(status)).search(make_ctx(), "x", 3)
    assert exc.value.code == code and exc.value.retryable is retryable


async def test_search_budget_is_hard() -> None:
    from app.pipeline.context import BudgetExhausted

    b = brave(lambda _r: httpx.Response(200, json={"web": {"results": []}}))
    ctx = make_ctx(max_search_queries=1)
    await b.search(ctx, "one", 3)
    with pytest.raises(BudgetExhausted):
        await b.search(ctx, "two", 3)


def test_usable_hits_filters_social_own_site_and_duplicates_domains() -> None:
    hits = [
        SearchHit("https://www.linkedin.com/company/acme", "li", ""),
        SearchHit("https://acme.example/x", "own", ""),
        SearchHit("https://news.example/a", "a", ""),
        SearchHit("https://news.example/b", "b", ""),
        SearchHit("https://other.example/c", "c", ""),
        SearchHit("https://seen.example/d", "d", ""),
    ]
    got = usable_hits(hits, "acme.example", {"https://seen.example/d"}, 5)
    assert [h.url for h in got] == ["https://news.example/a", "https://other.example/c"]


async def test_web_search_and_news_collectors_fetch_hits_and_set_dates() -> None:
    class P(NullSearch):
        available = True

        async def search(self, ctx, query, count):  # type: ignore[no-untyped-def]
            return [SearchHit("https://blog.example/acme-hiring", "t", "s")]

        async def news(self, ctx, query, count):  # type: ignore[no-untyped-def]
            return [SearchHit("https://www.prnewswire.com/acme", "Acme raises", "s", None)]

    routes = {
        "https://blog.example/robots.txt": httpx.Response(404),
        "https://www.prnewswire.com/robots.txt": httpx.Response(404),
        "https://blog.example/acme-hiring": html(
            "<main><h1>Acme is hiring SDRs</h1><p>Text of the post about hiring.</p></main>"
        ),
        "https://www.prnewswire.com/acme": html(fixture("acme_news.html")),
    }
    f, ctx = fetcher(routes), make_ctx()
    web = await WebSearchCollector(P(), f, ["q"]).collect(ctx, QUERY)
    news = await NewsCollector(P(), f, ["q"]).collect(ctx, QUERY)
    assert web[0].source_type == SourceType.SEARCH and news[0].source_type == SourceType.PRESS_RELEASE
    assert news[0].published_at is not None


async def test_collectors_degrade_when_no_search_provider() -> None:
    ctx = make_ctx()
    f = fetcher({})
    assert await WebSearchCollector(NullSearch(), f, ["q"]).collect(ctx, QUERY) == []
    assert await NewsCollector(NullSearch(), f, ["q"]).collect(ctx, QUERY) == []
    assert any("web_search_unavailable" in w for w in ctx.warnings) and any(
        "news_unavailable" in w for w in ctx.warnings
    )


def test_planner_is_deterministic_and_deduplicated() -> None:
    a = plan_queries("Acme", "acme.example", ["outbound", "SDR"], ["SDR", "AE"])
    assert a == plan_queries("Acme", "acme.example", ["outbound", "SDR"], ["SDR", "AE"])
    assert [p.kind for p in a][:4] == ["funding", "expansion", "hiring", "leadership"]
    assert len({p.text for p in a}) == len(a)
    assert all("Acme" in q for q in news_queries(a) + web_queries(a))


def test_feed_parser_handles_rss_atom_and_garbage() -> None:
    rss = "<rss><channel><item><title>A</title><link>https://x/a</link><pubDate>Tue, 08 Sep 2026 10:00:00 GMT</pubDate></item></channel></rss>"
    atom = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>B</title><link href="https://x/b"/><updated>2026-09-01T00:00:00Z</updated></entry></feed>'
    assert parse_feed(rss)[0].published_at.year == 2026  # type: ignore[union-attr]
    assert parse_feed(atom)[0].link == "https://x/b"
    assert parse_feed("<<not xml") == []
    assert (
        parse_feed('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]><rss>&a;</rss>') == []
    )  # XXE-safe


def test_registrable_domain_uses_public_suffix_list() -> None:
    assert registrable_domain("https://blog.acme.co.uk/x") == "acme.co.uk"
    assert registrable_domain("careers.acme.example") == "acme.example"
