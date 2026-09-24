"""Contract tests: invariants on every fixture result + the shape Next.js relies on."""

import json
from pathlib import Path

import pytest
from app.contracts.common import CONTRACT_VERSION
from app.contracts.invariants import check_invariants
from app.contracts.result import ResearchResult
from app.contracts.runs import RunRequest
from app.fake.pipeline import FakePipeline
from app.main import create_app
from app.pipeline.context import PipelineContext

from tests.conftest import make_settings, run_body

FAKE_DOMAINS = [
    "acme.example",
    "thin.example",
    "homonym.example",
    "none.example",
    "partial.example",
    "unknown.example",
]


@pytest.mark.parametrize("domain", FAKE_DOMAINS)
async def test_every_fake_result_satisfies_the_contract_invariants(domain: str) -> None:
    req = RunRequest.model_validate(run_body(domain))
    result = await FakePipeline().execute(PipelineContext("r", req))
    assert check_invariants(result) == []
    # round-trips through JSON exactly (what Next.js will parse)
    assert ResearchResult.model_validate_json(result.model_dump_json()) == result


def test_invariant_checker_catches_violations() -> None:
    import copy

    req = RunRequest.model_validate(run_body("acme.example"))
    import asyncio

    good = asyncio.run(FakePipeline().execute(PipelineContext("r", req)))
    bad = copy.deepcopy(good)
    bad.signals[0].evidence_ids = ["ev_999"]
    assert any("does not resolve" in p for p in check_invariants(bad))
    bad2 = copy.deepcopy(good)
    bad2.evidence[0].verification.verified = False  # a verified signal now rests on unverified evidence
    assert any("verified signal references unverified evidence" in p for p in check_invariants(bad2))
    assert any(
        "was not fetched" in p for p in check_invariants(good, fetched_urls={"https://elsewhere.example"})
    )


def test_openapi_is_committed_and_in_sync() -> None:
    committed = Path(__file__).resolve().parents[2] / "openapi.json"
    assert committed.exists(), "run `make openapi`"
    fresh = create_app(make_settings()).openapi()
    assert json.loads(committed.read_text()) == json.loads(json.dumps(fresh, sort_keys=True)), (
        "openapi.json is stale: run `make openapi`"
    )
    assert fresh["info"]["version"] == CONTRACT_VERSION
    assert {
        "/v1/runs",
        "/v1/runs/{run_id}",
        "/v1/score",
        "/v1/evidence/validate",
        "/v1/capabilities",
        "/healthz",
    } <= set(fresh["paths"])
