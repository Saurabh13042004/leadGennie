import httpx
import pytest
from app.pipeline.context import BudgetExhausted
from app.sources.fetch import Fetcher, FetchError, is_public_ip
from app.store.memory import MemoryHostLimiter, MemorySourceCache

from tests.helpers import (
    FakeResolver,
    RecordingLimiter,
    fixture,
    html,
    make_ctx,
    make_settings,
    site_transport,
)


def fetcher(routes, *, resolver=None, limiter=None, cache=None, **settings):  # type: ignore[no-untyped-def]
    transport = site_transport(routes)
    client = httpx.AsyncClient(transport=transport, follow_redirects=False)
    f = Fetcher(
        make_settings(**settings),
        limiter or MemoryHostLimiter(),
        cache or MemorySourceCache(),
        client=client,
        resolver=resolver or FakeResolver(),
    )
    return f, transport


ROBOTS_OK = {"https://acme.example/robots.txt": httpx.Response(404)}


@pytest.mark.parametrize(
    "ip,public",
    [
        ("93.184.216.34", True),
        ("8.8.8.8", True),
        ("10.0.0.1", False),
        ("172.16.5.4", False),
        ("192.168.1.1", False),
        ("127.0.0.1", False),
        ("169.254.169.254", False),
        ("100.64.0.1", False),
        ("0.0.0.0", False),
        ("::1", False),
        ("fe80::1", False),
        ("fc00::1", False),
        ("::ffff:10.0.0.1", False),
        ("224.0.0.1", False),
        ("not-an-ip", False),
    ],
)
def test_is_public_ip(ip: str, public: bool) -> None:
    assert is_public_ip(ip) is public


@pytest.mark.parametrize(
    "url,kind",
    [
        ("http://10.0.0.5/admin", "blocked_private"),
        ("http://169.254.169.254/latest/meta-data/", "blocked_private"),
        ("http://[::1]/", "blocked_private"),
        ("ftp://acme.example/file", "scheme"),
        ("file:///etc/passwd", "scheme"),
        ("https://user:pass@acme.example/", "url"),
        ("https://acme.example:8443/", "port"),
    ],
)
async def test_dangerous_urls_are_refused_without_a_request(url: str, kind: str) -> None:
    f, transport = fetcher({})
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), url)
    assert exc.value.kind == kind and transport.requests == []  # type: ignore[attr-defined]


async def test_hostname_resolving_to_private_address_is_blocked() -> None:
    f, transport = fetcher({}, resolver=FakeResolver({"evil.example": ["10.1.2.3"]}))
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://evil.example/")
    assert exc.value.kind == "blocked_private" and transport.requests == []  # type: ignore[attr-defined]


async def test_mixed_public_and_private_answers_are_blocked() -> None:
    """DNS-rebinding style: one public + one private address must not pass."""
    f, _ = fetcher({}, resolver=FakeResolver({"rebind.example": ["93.184.216.34", "127.0.0.1"]}))
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://rebind.example/")
    assert exc.value.kind == "blocked_private"


async def test_redirect_to_cloud_metadata_ip_is_blocked() -> None:
    routes = {
        **ROBOTS_OK,
        "https://acme.example/": httpx.Response(302, headers={"location": "http://169.254.169.254/latest/"}),
    }
    f, _ = fetcher(routes)
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/")
    assert exc.value.kind == "blocked_private"


async def test_redirect_to_host_that_resolves_private_is_blocked() -> None:
    routes = {
        **ROBOTS_OK,
        "https://acme.example/": httpx.Response(301, headers={"location": "https://internal.example/x"}),
    }
    f, _ = fetcher(routes, resolver=FakeResolver({"internal.example": ["192.168.0.10"]}))
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/")
    assert exc.value.kind == "blocked_private"


async def test_redirect_loop_is_capped() -> None:
    routes = {
        **ROBOTS_OK,
        "https://acme.example/": httpx.Response(302, headers={"location": "https://acme.example/"}),
    }
    f, transport = fetcher(routes)
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/")
    assert exc.value.kind == "redirect_loop"
    assert len(transport.requests) <= 8  # type: ignore[attr-defined]


async def test_peer_address_is_rechecked_after_connect() -> None:
    class Stream:
        def get_extra_info(self, name: str):  # type: ignore[no-untyped-def]
            return ("10.9.9.9", 443) if name == "server_addr" else None

    routes = {
        **ROBOTS_OK,
        "https://acme.example/": httpx.Response(
            200,
            text="<p>hi</p>",
            headers={"content-type": "text/html"},
            extensions={"network_stream": Stream()},
        ),
    }
    f, _ = fetcher(routes)
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/")
    assert exc.value.kind == "blocked_private"


async def test_body_size_cap_on_streamed_body_and_declared_length() -> None:
    big = "x" * 5000
    routes = {
        **ROBOTS_OK,
        "https://acme.example/big": html(big),
        "https://acme.example/declared": html("small", **{"content-length": "999999"}),
    }
    f, _ = fetcher(routes, fetch_max_bytes=1000)
    with pytest.raises(FetchError) as e1:
        await f.fetch_page(make_ctx(), "https://acme.example/big")
    assert e1.value.kind == "too_large"
    with pytest.raises(FetchError) as e2:
        await f.fetch_page(make_ctx(), "https://acme.example/declared")
    assert e2.value.kind == "too_large"


@pytest.mark.parametrize("ctype", ["application/pdf", "image/png", "application/octet-stream", "video/mp4"])
async def test_disallowed_content_types(ctype: str) -> None:
    routes = {
        **ROBOTS_OK,
        "https://acme.example/f": httpx.Response(200, content=b"x", headers={"content-type": ctype}),
    }
    f, _ = fetcher(routes)
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/f")
    assert exc.value.kind == "bad_type"


async def test_timeout_and_http_errors_map_to_stable_kinds() -> None:
    def boom(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow")

    routes = {
        **ROBOTS_OK,
        "https://acme.example/slow": boom,
        "https://acme.example/gone": httpx.Response(404),
        "https://acme.example/err": httpx.Response(503),
    }
    f, _ = fetcher(routes)
    for path, kind in (("slow", "timeout"), ("gone", "http_4xx"), ("err", "http_5xx")):
        with pytest.raises(FetchError) as exc:
            await f.fetch_page(make_ctx(), f"https://acme.example/{path}")
        assert exc.value.kind == kind


async def test_robots_disallow_is_honored_for_our_user_agent() -> None:
    routes = {
        "https://acme.example/robots.txt": httpx.Response(200, text=fixture("robots_disallow.txt")),
        "https://acme.example/careers": html("<p>jobs</p>"),
        "https://acme.example/about": html("<p>about us</p>"),
    }
    f, transport = fetcher(routes)
    with pytest.raises(FetchError) as exc:
        await f.fetch_page(make_ctx(), "https://acme.example/careers")
    assert exc.value.kind == "robots"
    assert (await f.fetch_page(make_ctx(), "https://acme.example/about")).text == "about us"
    assert "https://acme.example/careers" not in {str(r.url) for r in transport.requests}  # type: ignore[attr-defined]


async def test_missing_robots_allows_but_server_error_is_conservative() -> None:
    f, _ = fetcher({**ROBOTS_OK, "https://acme.example/a": html("<p>a page</p>")})
    assert (await f.fetch_page(make_ctx(), "https://acme.example/a")).text == "a page"
    f2, _ = fetcher(
        {"https://acme.example/robots.txt": httpx.Response(500), "https://acme.example/a": html("<p>x</p>")}
    )
    with pytest.raises(FetchError) as exc:
        await f2.fetch_page(make_ctx(), "https://acme.example/a")
    assert exc.value.kind == "robots"


async def test_per_host_limiter_is_used_for_pages_and_robots() -> None:
    limiter = RecordingLimiter()
    f, _ = fetcher({**ROBOTS_OK, "https://acme.example/a": html("<p>a page</p>")}, limiter=limiter)
    await f.fetch_page(make_ctx(), "https://acme.example/a")
    assert limiter.hosts == ["acme.example", "acme.example"]  # robots.txt + the page


async def test_page_budget_is_hard_and_cache_hits_are_free() -> None:
    routes = {
        **ROBOTS_OK,
        "https://acme.example/a": html("<p>a page</p>"),
        "https://acme.example/b": html("<p>b page</p>"),
    }
    cache = MemorySourceCache()
    f, transport = fetcher(routes, cache=cache)
    ctx = make_ctx(max_pages=1)
    await f.fetch_page(ctx, "https://acme.example/a", max_age_seconds=3600)
    with pytest.raises(BudgetExhausted):
        await f.fetch_page(ctx, "https://acme.example/b")
    n = len(transport.requests)  # type: ignore[attr-defined]
    again = await f.fetch_page(ctx, "https://acme.example/a", max_age_seconds=3600)  # served from cache
    assert again.text == "a page" and len(transport.requests) == n  # type: ignore[attr-defined]
    assert ctx.budget.pages == 1


async def test_fetched_documents_are_registered_and_usage_recorded() -> None:
    f, _ = fetcher({**ROBOTS_OK, "https://acme.example/": html(fixture("acme_home.html"))})
    ctx = make_ctx()
    doc = await f.fetch_page(ctx, "https://acme.example/")
    assert "https://acme.example/" in ctx.docs and doc.html_hash.startswith("sha256:")
    assert sum(u.units for u in ctx.usage if u.kind == "fetch") >= 1


async def test_injection_like_content_is_flagged_not_obeyed() -> None:
    f, _ = fetcher({**ROBOTS_OK, "https://acme.example/": html(fixture("hostile.html"))})
    ctx = make_ctx()
    doc = await f.fetch_page(ctx, "https://acme.example/")
    assert doc.injection_flagged and "injection_like_content_flagged" in ctx.warnings
    assert "5000 employees" in doc.text  # content is preserved as data (the validator will judge it)
