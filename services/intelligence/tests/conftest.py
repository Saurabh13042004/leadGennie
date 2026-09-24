from __future__ import annotations

import json
import time
from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from app import clock
from app.auth import sign
from app.config import Settings
from app.container import Container, build_container
from app.main import create_app

TOKEN = "test-token-abc"
SECRET = "test-secret-xyz"


def make_settings(**overrides: Any) -> Settings:
    base: dict[str, Any] = {
        "intelligence_service_token": TOKEN,
        "intelligence_signing_secret": SECRET,
        "engine_fake_mode": True,
        "log_level": "WARNING",
        "_env_file": None,
    }
    base.update(overrides)
    return Settings(**base)


class SignedClient:
    """httpx client that signs every request the way the Next.js app does."""

    def __init__(self, client: httpx.AsyncClient, secret: str = SECRET, token: str = TOKEN) -> None:
        self.client, self.secret, self.token = client, secret, token

    def headers(
        self, method: str, path: str, body: bytes, *, timestamp: float | None = None
    ) -> dict[str, str]:
        ts = str(timestamp if timestamp is not None else time.time())
        return {
            "Authorization": f"Bearer {self.token}",
            "X-LG-Timestamp": ts,
            "X-LG-Signature": sign(self.secret, ts, method, path, body),
            "Content-Type": "application/json",
        }

    async def request(self, method: str, path: str, json_body: Any = None, **kw: Any) -> httpx.Response:
        body = json.dumps(json_body).encode() if json_body is not None else b""
        return await self.client.request(
            method, path, content=body, headers=self.headers(method, path, body, **kw)
        )

    async def get(self, path: str) -> httpx.Response:
        return await self.request("GET", path)

    async def post(self, path: str, json_body: Any = None) -> httpx.Response:
        return await self.request("POST", path, json_body if json_body is not None else {})


def run_body(
    domain: str = "acme.example",
    *,
    name: str = "Acme",
    key: str | None = None,
    lead: bool = True,
    icp: dict[str, Any] | None = None,
    budgets: dict[str, Any] | None = None,
) -> dict[str, Any]:
    body: dict[str, Any] = {
        "idempotency_key": key or f"test:{domain}:{time.time_ns()}",
        "task": "lead_research" if lead else "company_research",
        "input": {"company": {"name": name, "domain": domain}},
        "context": {
            "icp": icp if icp is not None else DEFAULT_ICP,
            "positioning": "We help outbound teams.",
            "offer_keywords": ["outbound"],
        },
    }
    if lead:
        body["input"]["lead"] = {"name": "Sarah Chen", "title": "VP Sales"}
    if budgets:
        body["budgets"] = budgets
    return body


DEFAULT_ICP = {
    "industries": [{"value": "b2b_saas", "weight": 25}],
    "employee_range": {"min": 50, "max": 500, "weight": 20},
    "geographies": [{"value": "IN", "weight": 15}],
    "titles": [{"seniority": ["vp", "head", "cxo"], "function": ["sales"], "weight": 25}],
    "keyword_signals": [{"keyword": "outbound", "weight": 15}],
    "min_score_to_qualify": 70,
}


@pytest.fixture
async def container() -> AsyncIterator[Container]:
    c = await build_container(make_settings())
    yield c
    await c.runs.shutdown()


@pytest.fixture
async def api(container: Container) -> AsyncIterator[SignedClient]:
    app = create_app(container.settings, container)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://engine") as client:
            yield SignedClient(client)


async def wait_for(api: SignedClient, run_id: str, timeout: float = 10.0) -> dict[str, Any]:
    import asyncio

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        data: dict[str, Any] = (await api.get(f"/v1/runs/{run_id}")).json()["data"]
        if data["status"] in ("succeeded", "failed", "canceled"):
            return data
        await asyncio.sleep(0.05)
    raise AssertionError(f"run {run_id} did not finish in {timeout}s")


@pytest.fixture(autouse=True)
def frozen_clock() -> AsyncIterator[None]:
    """Recency windows and score decay depend on 'now' — pin it so fixture dates never rot."""
    from datetime import UTC, datetime

    clock.freeze(datetime(2026, 9, 24, 12, 0, tzinfo=UTC))
    yield
    clock.freeze(None)
