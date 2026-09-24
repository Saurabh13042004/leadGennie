import asyncio

from app.contracts.invariants import check_invariants
from app.contracts.result import ResearchResult

from tests.conftest import SignedClient, run_body, wait_for


async def test_create_poll_and_result_satisfy_contract_invariants(api: SignedClient) -> None:
    r = await api.post("/v1/runs", run_body("acme.example"))
    assert r.status_code == 202
    run_id = r.json()["data"]["run_id"]
    data = await wait_for(api, run_id)
    assert data["status"] == "succeeded" and data["progress"]["pct"] == 100
    result = ResearchResult.model_validate(data["result"])
    assert check_invariants(result) == []
    assert result.icp.score > 0 and result.qualified
    assert {s.type.value for s in result.signals if s.verified} == {"HIRING", "EXPANSION"}
    assert data["usage"], "usage must be returned so Next can record it"


async def test_all_fixtures_satisfy_invariants_and_scoring_rules(api: SignedClient) -> None:
    for domain in ("acme.example", "thin.example", "homonym.example", "none.example", "unknown-co.example"):
        rid = (await api.post("/v1/runs", run_body(domain, name=domain.split(".")[0].title()))).json()[
            "data"
        ]["run_id"]
        data = await wait_for(api, rid)
        assert data["status"] == "succeeded", domain
        result = ResearchResult.model_validate(data["result"])
        assert check_invariants(result) == [], domain
        for s in result.signals:  # unverified signals never contribute
            if not s.verified:
                assert all(i.signal_id != s.id for i in result.intent.breakdown)


async def test_homonym_returns_unverified_signal_flagged_not_used(api: SignedClient) -> None:
    rid = (await api.post("/v1/runs", run_body("homonym.example", name="Homonym"))).json()["data"]["run_id"]
    result = ResearchResult.model_validate((await wait_for(api, rid))["result"])
    assert "ambiguous_entity" in result.warnings
    assert result.intent.score == 0 and [s.verified for s in result.signals] == [False]


async def test_idempotency_key_returns_same_run(api: SignedClient) -> None:
    body = run_body("acme.example", key="idem-key-0001")
    a = (await api.post("/v1/runs", body)).json()["data"]["run_id"]
    b = (await api.post("/v1/runs", body)).json()["data"]["run_id"]
    assert a == b
    await wait_for(api, a)
    assert (await api.post("/v1/runs", body)).json()["data"]["run_id"] == a


async def test_cancel_running_run(api: SignedClient) -> None:
    rid = (await api.post("/v1/runs", run_body("slow.example", name="Slow"))).json()["data"]["run_id"]
    await asyncio.sleep(0.2)
    await api.post(f"/v1/runs/{rid}/cancel")
    data = await wait_for(api, rid)
    assert data["status"] == "canceled" and data["result"] is None


async def test_retryable_failure_is_restarted_by_resubmitting_same_key(api: SignedClient, container) -> None:  # type: ignore[no-untyped-def]
    body = run_body("acme.example", key="retry-key-0001")
    rid = (await api.post("/v1/runs", body)).json()["data"]["run_id"]
    await wait_for(api, rid)
    # simulate an engine crash mid-run: a retryable failure
    await container.store.runs.update(
        rid,
        status="failed",
        error={"code": "UNAVAILABLE", "message": "engine restarted", "details": None, "retryable": True},
        result=None,
    )
    again = (await api.post("/v1/runs", body)).json()["data"]
    assert again["run_id"] == rid
    assert (await wait_for(api, rid))["status"] == "succeeded"


async def test_non_retryable_failure_is_not_restarted(api: SignedClient) -> None:
    body = run_body("quota.example", name="Quota", key="quota-key-0001")
    rid = (await api.post("/v1/runs", body)).json()["data"]["run_id"]
    data = await wait_for(api, rid)
    assert (
        data["status"] == "failed"
        and data["error"]["code"] == "QUOTA_EXCEEDED"
        and data["error"]["retryable"] is False
    )
    assert (await api.post("/v1/runs", body)).json()["data"]["status"] == "failed"


async def test_partial_result_carries_budget_warning(api: SignedClient) -> None:
    rid = (await api.post("/v1/runs", run_body("partial.example", name="Partial"))).json()["data"]["run_id"]
    result = (await wait_for(api, rid))["result"]
    assert "budget_exhausted:max_pages" in result["warnings"]


async def test_validation_errors_use_the_error_envelope(api: SignedClient) -> None:
    r = await api.post("/v1/runs", {"idempotency_key": "x", "task": "nope", "input": {}})
    assert r.status_code == 422
    body = r.json()
    assert body["ok"] is False and body["error"]["code"] == "VALIDATION" and body["error"]["details"]


async def test_unknown_run_is_404_envelope(api: SignedClient) -> None:
    r = await api.get("/v1/runs/run_missing")
    assert r.status_code == 404 and r.json()["error"]["code"] == "NOT_FOUND"


async def test_unknown_fields_are_rejected(api: SignedClient) -> None:
    body = run_body("acme.example")
    body["budgets"] = {"max_pages": 5, "surprise": 1}
    assert (await api.post("/v1/runs", body)).status_code == 422


async def test_score_endpoint_is_pure_and_deterministic(api: SignedClient) -> None:
    body = {
        "icp": run_body()["context"]["icp"],
        "company": {"industry": "SaaS", "country": "India", "employee_count": 120},
        "person": {"title": "VP Sales"},
        "signals": [
            {"type": "HIRING", "confidence": 0.9, "detected_at": "2026-09-10", "verified": True},
            {"type": "FUNDING", "confidence": 0.9, "detected_at": "2026-09-10", "verified": False},
        ],
        "as_of": "2026-09-24",
    }
    a = (await api.post("/v1/score", body)).json()["data"]
    b = (await api.post("/v1/score", body)).json()["data"]
    assert a == b and a["icp"]["score"] > 0
    assert len(a["intent"]["breakdown"]) == 1  # the unverified FUNDING signal has zero influence


async def test_capabilities_reports_fake_mode(api: SignedClient) -> None:
    data = (await api.get("/v1/capabilities")).json()["data"]
    assert data["fake_mode"] is True and "company_research" in data["tasks"]


async def test_validate_endpoint_refetches_and_verifies_or_rejects() -> None:
    import httpx
    from app.container import build_container
    from app.llm.fake import FakeLlm
    from app.main import create_app
    from app.pipeline.factory import make_validate_fn
    from app.sources.fetch import Fetcher
    from app.store.memory import MemoryHostLimiter, MemorySourceCache

    from tests.conftest import make_settings as api_settings
    from tests.helpers import FakeResolver, fixture, html, site_transport
    from tests.judges import honest

    settings = api_settings(engine_fake_mode=True, fetch_host_rps=0)
    routes = {
        "https://acme.example/robots.txt": httpx.Response(404),
        "https://acme.example/about": html(fixture("acme_about.html")),
    }
    fetcher = Fetcher(
        settings,
        MemoryHostLimiter(),
        MemorySourceCache(),
        client=httpx.AsyncClient(transport=site_transport(routes)),
        resolver=FakeResolver(),
    )
    c = await build_container(settings)
    c.validate_claims = make_validate_fn(settings, fetcher, FakeLlm().on("entailment", honest))
    app = create_app(settings, c)
    async with app.router.lifespan_context(app):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://engine") as client:
            api = SignedClient(client)
            body = {
                "claims": [
                    {
                        "id": "ok",
                        "claim": "Acme has 120 employees",
                        "source_url": "https://acme.example/about",
                        "snippet": "We are a team of 120 people across Bengaluru and Austin.",
                        "company_name": "Acme",
                        "company_domain": "acme.example",
                    },
                    {
                        "id": "bad-number",
                        "claim": "Acme has 900 employees",
                        "source_url": "https://acme.example/about",
                        "snippet": "We are a team of 120 people across Bengaluru and Austin.",
                        "company_name": "Acme",
                        "company_domain": "acme.example",
                    },
                    {
                        "id": "not-fetchable",
                        "claim": "Acme has 120 employees",
                        "source_url": "https://acme.example/missing",
                        "snippet": "We are a team of 120 people.",
                        "company_name": "Acme",
                        "company_domain": "acme.example",
                    },
                ]
            }
            data = (await api.post("/v1/evidence/validate", body)).json()["data"]["verdicts"]
            verdicts = {v["id"]: v["verdict"]["verified"] for v in data}
            assert verdicts == {"ok": True, "bad-number": False, "not-fetchable": False}
            assert any(
                ch["name"] == "url_fetched" and not ch["passed"]
                for v in data
                if v["id"] == "not-fetchable"
                for ch in v["checks"]
            )
    await c.runs.shutdown()


async def test_validate_endpoint_is_unavailable_in_fake_mode(api: SignedClient) -> None:
    r = await api.post(
        "/v1/evidence/validate",
        {
            "claims": [
                {
                    "id": "a",
                    "claim": "Acme has 120 employees",
                    "source_url": "https://x.example",
                    "snippet": "team of 120",
                    "company_name": "Acme",
                }
            ]
        },
    )
    assert r.status_code == 503 and r.json()["error"]["code"] == "UNAVAILABLE"


async def test_cancel_before_the_run_starts_is_honored_not_overwritten(container) -> None:  # type: ignore[no-untyped-def]
    from app.contracts.runs import RunRequest

    req = RunRequest.model_validate(run_body("slow.example", name="Slow", key="early-cancel-0001"))
    rec = await container.runs.submit(req)
    await container.runs.cancel(rec.run_id)  # the task has been scheduled but has not run yet
    for _ in range(100):
        view = await container.runs.view(rec.run_id)
        if view and view.status.terminal:
            break
        await asyncio.sleep(0.02)
    assert view is not None and view.status.value == "canceled"


async def test_sse_progress_stream_ends_with_done(api: SignedClient) -> None:
    rid = (await api.post("/v1/runs", run_body("acme.example"))).json()["data"]["run_id"]
    resp = await api.get(f"/v1/runs/{rid}/events")
    assert resp.status_code == 200 and resp.headers["content-type"].startswith("text/event-stream")
    body = resp.text
    assert "event: progress" in body and body.rstrip().endswith('data: {"status": "succeeded"}')
