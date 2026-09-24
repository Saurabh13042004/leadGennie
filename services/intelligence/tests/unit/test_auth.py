import time

import httpx
from app.container import build_container
from app.main import create_app

from tests.conftest import SECRET, TOKEN, SignedClient, make_settings


async def test_rejects_missing_credentials(api: SignedClient) -> None:
    r = await api.client.get("/v1/capabilities")
    assert r.status_code == 401
    assert r.json() == {
        "ok": False,
        "error": {
            "code": "UNAUTHENTICATED",
            "message": "Invalid credentials",
            "details": None,
            "retryable": False,
        },
    }


async def test_rejects_wrong_token(api: SignedClient) -> None:
    bad = SignedClient(api.client, token="nope")
    assert (await bad.get("/v1/capabilities")).status_code == 401


async def test_rejects_bad_signature_and_tampered_body(api: SignedClient) -> None:
    bad = SignedClient(api.client, secret="wrong-secret")
    assert (await bad.get("/v1/capabilities")).status_code == 401
    # a valid signature for one body must not authorize another
    body = b'{"claims": []}'
    headers = api.headers("POST", "/v1/score", body)
    r = await api.client.post("/v1/score", content=b'{"icp": {}}', headers=headers)
    assert r.status_code == 401


async def test_signature_is_bound_to_method_and_path(api: SignedClient) -> None:
    headers = api.headers("GET", "/v1/capabilities", b"")
    r = await api.client.get("/healthz-not", headers=headers)  # different path
    assert r.status_code in (401, 404)
    r2 = await api.client.post("/v1/capabilities", content=b"", headers=headers)  # different method
    assert r2.status_code in (401, 405)


async def test_rejects_stale_and_future_timestamps(api: SignedClient) -> None:
    for ts in (time.time() - 3600, time.time() + 3600):
        r = await api.client.get(
            "/v1/capabilities", headers=api.headers("GET", "/v1/capabilities", b"", timestamp=ts)
        )
        assert r.status_code == 401


async def test_accepts_previous_secret_during_rotation() -> None:
    settings = make_settings(
        intelligence_signing_secret="new-secret", intelligence_signing_secret_previous=SECRET
    )
    c = await build_container(settings)
    app = create_app(settings, c)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://e") as client:
            assert (await SignedClient(client, secret=SECRET).get("/v1/capabilities")).status_code == 200
            assert (
                await SignedClient(client, secret="new-secret").get("/v1/capabilities")
            ).status_code == 200
            assert (await SignedClient(client, secret="other").get("/v1/capabilities")).status_code == 401
    await c.runs.shutdown()


async def test_fails_closed_when_credentials_not_configured() -> None:
    settings = make_settings(intelligence_service_token="", intelligence_signing_secret="")
    c = await build_container(settings)
    app = create_app(settings, c)
    async with app.router.lifespan_context(app):
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://e") as client:
            r = await client.get("/v1/capabilities", headers={"Authorization": f"Bearer {TOKEN}"})
            assert r.status_code == 503
    await c.runs.shutdown()


async def test_health_endpoints_are_public_and_versioned(api: SignedClient) -> None:
    r = await api.client.get("/healthz")
    assert r.status_code == 200 and r.headers["X-Contract-Version"] == "1.0" and "X-Request-Id" in r.headers
    assert (await api.client.get("/readyz")).status_code == 200
