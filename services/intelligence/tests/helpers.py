from __future__ import annotations

from collections.abc import Callable
from pathlib import Path
from typing import Any

import httpx
from app.config import Settings
from app.contracts.runs import RunRequest
from app.pipeline.context import PipelineContext

FIXTURES = Path(__file__).parent / "fixtures" / "sites"


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text()


class FakeResolver:
    """Maps hostnames to IPs so tests never do real DNS. Unknown hosts resolve to a public address."""

    def __init__(self, mapping: dict[str, list[str]] | None = None) -> None:
        self.mapping = mapping or {}
        self.calls: list[str] = []

    async def resolve(self, host: str) -> list[str]:
        self.calls.append(host)
        return self.mapping.get(host, ["93.184.216.34"])


class RecordingLimiter:
    def __init__(self) -> None:
        self.hosts: list[str] = []

    async def acquire(self, host: str, rps: float) -> None:
        self.hosts.append(host)


Route = httpx.Response | Callable[[httpx.Request], httpx.Response]


def site_transport(routes: dict[str, Route], *, default_404: bool = True) -> httpx.MockTransport:
    """A fake internet: URL -> response (or a handler). Records requests on `.requests`."""
    seen: list[httpx.Request] = []
    times: list[tuple[str, float]] = []  # (host, monotonic time) of every request, for rate assertions

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        times.append((request.url.host, __import__("time").monotonic()))
        route = routes.get(str(request.url))
        if route is None:
            if default_404:
                return httpx.Response(404, text="not found")
            raise AssertionError(f"unexpected request: {request.url}")
        return route(request) if callable(route) else route

    transport = httpx.MockTransport(handler)
    transport.requests = seen  # type: ignore[attr-defined]
    transport.times = times  # type: ignore[attr-defined]
    return transport


def html(body: str, status: int = 200, **headers: str) -> httpx.Response:
    return httpx.Response(status, text=body, headers={"content-type": "text/html; charset=utf-8", **headers})


def make_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = {"fetch_host_rps": 0, "log_level": "WARNING", "_env_file": None}
    base.update(overrides)
    return Settings(**base)


def make_request(domain: str = "acme.example", **budgets: Any) -> RunRequest:
    return RunRequest.model_validate(
        {
            "idempotency_key": "test-key-0001",
            "task": "lead_research",
            "input": {
                "company": {"name": "Acme", "domain": domain},
                "lead": {"name": "Sarah Chen", "title": "VP Sales"},
            },
            "context": {"positioning": "We help outbound teams.", "offer_keywords": ["outbound", "SDR"]},
            "budgets": budgets or {},
        }
    )


def make_ctx(**budgets: Any) -> PipelineContext:
    return PipelineContext("run_test", make_request(**budgets))
