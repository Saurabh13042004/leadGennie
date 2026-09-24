"""The guarded fetch layer — every connector goes through this and nothing else touches the network.

Defenses: http(s) only, no credentials in URLs, DNS resolved + every address must be public (blocks private,
loopback, link-local, cloud-metadata ranges), re-checked on EVERY redirect, peer address re-checked after
connect (DNS rebinding), redirect cap, robots.txt, shared per-host rate limit, timeouts, body-size cap on the
decoded stream (decompression bombs), content-type allowlist, honest User-Agent. No login-wall / CAPTCHA /
proxy-rotation evasion: a block is recorded and we move on.
"""

from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.robotparser import RobotFileParser

import httpx

from app.config import Settings
from app.contracts.common import SourceType, UsageItem
from app.documents import RawDocument
from app.injection import scan_for_injection
from app.pipeline.context import PipelineContext
from app.sources.html import parse_html
from app.store.base import HostLimiter, SourceCache
from app.telemetry.logging import get_logger

log = get_logger(__name__)

ALLOWED_CONTENT_TYPES = (
    "text/html",
    "application/xhtml+xml",
    "text/plain",
    "application/json",
    "application/rss+xml",
    "application/atom+xml",
    "application/xml",
    "text/xml",
)
ROBOTS_TTL_SECONDS = 3600.0
STANDARD_PORTS = (None, 80, 443)


class FetchError(Exception):
    """A fetch was refused or failed. `kind` is stable and shows up in traces/warnings."""

    def __init__(self, kind: str, message: str, url: str = "") -> None:
        super().__init__(f"{kind}: {message}")
        self.kind = kind
        self.url = url


class Resolver(Protocol):
    async def resolve(self, host: str) -> list[str]: ...


class SystemResolver:
    async def resolve(self, host: str) -> list[str]:
        loop = asyncio.get_running_loop()
        try:
            infos = await loop.getaddrinfo(host, None, type=0)
        except OSError as exc:
            raise FetchError("dns", f"cannot resolve {host}") from exc
        return sorted({str(i[4][0]) for i in infos})


def is_public_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value.split("%")[0])
    except ValueError:
        return False
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
        ip = ip.ipv4_mapped
    return ip.is_global and not ip.is_multicast


@dataclass
class HttpResponse:
    url: str
    status: int
    headers: httpx.Headers
    body: bytes
    content_type: str


def _origin(url: str) -> str:
    p = urlparse(url)
    return f"{p.scheme}://{p.netloc}"


class Fetcher:
    def __init__(
        self,
        settings: Settings,
        limiter: HostLimiter,
        cache: SourceCache,
        *,
        client: httpx.AsyncClient | None = None,
        resolver: Resolver | None = None,
    ) -> None:
        self._s = settings
        self._limiter = limiter
        self._cache = cache
        self._resolver: Resolver = resolver or SystemResolver()
        self._client = client or httpx.AsyncClient(
            follow_redirects=False,
            timeout=httpx.Timeout(
                settings.fetch_timeout_seconds, connect=settings.fetch_connect_timeout_seconds
            ),
            headers={"User-Agent": settings.fetch_user_agent},
        )
        self._owns_client = client is None
        self._robots: dict[str, tuple[float, RobotFileParser | None]] = {}

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    # -- public ---------------------------------------------------------------------------------------

    async def fetch_page(
        self,
        ctx: PipelineContext,
        url: str,
        *,
        source_type: SourceType = SourceType.WEBSITE,
        collector: str = "website",
        max_age_seconds: float = 0,
    ) -> RawDocument:
        """Fetch + clean an HTML/text page into a RawDocument and register it in the run's document set."""
        url = self._normalize(url)
        if max_age_seconds > 0 and (cached := await self._cache.get(url, max_age_seconds)) is not None:
            ctx.docs.add(cached)
            return cached
        resp = await self._get(ctx, url, respect_robots=True)
        text_body = resp.body.decode(_charset(resp.headers) or "utf-8", errors="replace")
        html_hash = "sha256:" + hashlib.sha256(resp.body).hexdigest()
        if resp.content_type in ("text/html", "application/xhtml+xml"):
            page = parse_html(text_body, resp.url)
            text, title, links, metadata, published = (
                page.text,
                page.title,
                page.links,
                page.metadata,
                page.published_at,
            )
        else:
            text, title, links, metadata, published = text_body[:60_000], None, [], {}, None
        flags = scan_for_injection(text)
        doc = RawDocument(
            url=url,
            final_url=resp.url,
            title=title,
            fetched_at=datetime.now(UTC),
            status_code=resp.status,
            content_type=resp.content_type,
            text=text,
            html_hash=html_hash,
            published_at=published,
            source_type=source_type,
            collector=collector,
            links=links,
            metadata=metadata,
            injection_flagged=bool(flags),
        )
        if flags:
            ctx.warn("injection_like_content_flagged")
            log.warning("injection_like_content", url=url, patterns=flags[:3])
        ctx.docs.add(doc)
        if max_age_seconds > 0:
            await self._cache.put(doc, max(max_age_seconds, 3600))
        return doc

    async def fetch_json(self, ctx: PipelineContext, url: str, *, respect_robots: bool = False) -> Any:
        """Fetch a public JSON API (e.g. an ATS job board) through the same guardrails."""
        import json

        resp = await self._get(ctx, self._normalize(url), respect_robots=respect_robots)
        try:
            return json.loads(resp.body.decode(_charset(resp.headers) or "utf-8", errors="replace"))
        except ValueError as exc:
            raise FetchError("bad_json", "response is not valid JSON", url) from exc

    async def fetch_text(
        self, ctx: PipelineContext, url: str, *, respect_robots: bool = True
    ) -> HttpResponse:
        return await self._get(ctx, self._normalize(url), respect_robots=respect_robots)

    # -- guardrails -----------------------------------------------------------------------------------

    def _normalize(self, url: str) -> str:
        url, _ = urldefrag(url.strip())
        p = urlparse(url)
        if p.scheme not in ("http", "https"):
            raise FetchError("scheme", f"unsupported scheme {p.scheme!r}", url)
        if not p.hostname:
            raise FetchError("url", "missing host", url)
        if p.username or p.password:
            raise FetchError("url", "credentials in URL are not allowed", url)
        if not self._s.fetch_allow_private_network and p.port not in STANDARD_PORTS:
            raise FetchError("port", f"port {p.port} is not allowed", url)
        return url

    async def _assert_public(self, host: str) -> None:
        if self._s.fetch_allow_private_network:
            return
        try:
            ipaddress.ip_address(host)
            addresses = [host]
        except ValueError:
            addresses = await self._resolver.resolve(host)
        if not addresses:
            raise FetchError("dns", f"no addresses for {host}")
        bad = [a for a in addresses if not is_public_ip(a)]
        if bad:
            raise FetchError("blocked_private", f"{host} resolves to a non-public address", host)

    async def _robots_allows(self, ctx: PipelineContext, url: str) -> bool:
        origin = _origin(url)
        cached = self._robots.get(origin)
        if cached and time.monotonic() - cached[0] < ROBOTS_TTL_SECONDS:
            parser = cached[1]
        else:
            parser = await self._load_robots(ctx, origin)
            self._robots[origin] = (time.monotonic(), parser)
        if parser is None:  # robots could not be determined reliably → be conservative
            return False
        return parser.can_fetch("LeadGennieBot", url)

    async def _load_robots(self, ctx: PipelineContext, origin: str) -> RobotFileParser | None:
        parser = RobotFileParser()
        try:
            resp = await self._get(ctx, f"{origin}/robots.txt", respect_robots=False, count_page=False)
        except FetchError as exc:
            if exc.kind == "http_4xx":
                parser.parse([])  # no robots.txt → allowed
                return parser
            log.info("robots_unavailable", origin=origin, kind=exc.kind)
            return None
        parser.parse(resp.body.decode("utf-8", errors="replace").splitlines())
        return parser

    async def _get(
        self, ctx: PipelineContext, url: str, *, respect_robots: bool, count_page: bool = True
    ) -> HttpResponse:
        if count_page:
            ctx.budget.spend_page()
        current = url
        for _hop in range(self._s.fetch_max_redirects + 1):
            ctx.check_cancelled()
            parsed = urlparse(current)
            assert parsed.hostname
            await self._assert_public(parsed.hostname)
            if respect_robots and not await self._robots_allows(ctx, current):
                raise FetchError("robots", "disallowed by robots.txt", current)
            await self._limiter.acquire(parsed.hostname, self._s.fetch_host_rps)
            try:
                async with self._client.stream(
                    "GET",
                    current,
                    headers={"Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5"},
                ) as response:
                    self._assert_peer_public(response)
                    ctx.add_usage(UsageItem(kind="fetch", provider="http", units=1))
                    if response.is_redirect:
                        location = response.headers.get("location")
                        if not location:
                            raise FetchError("http", "redirect without Location", current)
                        current = self._normalize(urljoin(current, location))
                        continue
                    if 400 <= response.status_code < 500:
                        raise FetchError("http_4xx", f"HTTP {response.status_code}", current)
                    if response.status_code >= 500:
                        raise FetchError("http_5xx", f"HTTP {response.status_code}", current)
                    ctype = response.headers.get("content-type", "text/plain").split(";")[0].strip().lower()
                    if ctype not in ALLOWED_CONTENT_TYPES:
                        raise FetchError("bad_type", f"content type {ctype!r} is not allowed", current)
                    declared = response.headers.get("content-length")
                    if declared and declared.isdigit() and int(declared) > self._s.fetch_max_bytes:
                        raise FetchError("too_large", f"declared size {declared} exceeds limit", current)
                    chunks: list[bytes] = []
                    size = 0
                    async for chunk in response.aiter_bytes():
                        size += len(chunk)
                        if size > self._s.fetch_max_bytes:
                            raise FetchError("too_large", "response body exceeds limit", current)
                        chunks.append(chunk)
                    return HttpResponse(
                        current, response.status_code, response.headers, b"".join(chunks), ctype
                    )
            except httpx.TimeoutException as exc:
                raise FetchError("timeout", "request timed out", current) from exc
            except httpx.HTTPError as exc:
                raise FetchError("network", type(exc).__name__, current) from exc
        raise FetchError("redirect_loop", f"more than {self._s.fetch_max_redirects} redirects", url)

    def _assert_peer_public(self, response: httpx.Response) -> None:
        """DNS-rebinding defense: the address we actually connected to must be public too."""
        if self._s.fetch_allow_private_network:
            return
        stream = response.extensions.get("network_stream")
        addr = stream.get_extra_info("server_addr") if stream is not None else None
        if addr and not is_public_ip(str(addr[0])):
            raise FetchError("blocked_private", "connected peer address is not public", str(response.url))


def _charset(headers: httpx.Headers) -> str | None:
    ctype = headers.get("content-type", "")
    if "charset=" in ctype:
        return ctype.split("charset=")[-1].split(";")[0].strip().strip('"') or None
    return None
