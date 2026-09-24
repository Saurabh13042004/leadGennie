"""Budget-limited REAL run against a public site (real fetch + real OpenAI). Costs a few cents per company.

    make smoke DOMAIN=linear.app NAME="Linear"
    uv run python scripts/smoke.py linear.app Linear --lead "Alex Morgan" --title "Head of Growth" [--json]

With `--lead` it runs `lead_research` (Outreach agent included); otherwise `company_research`."""

from __future__ import annotations

import argparse
import asyncio
import json
import sys

from app.config import Settings
from app.contracts.invariants import check_invariants
from app.contracts.runs import RunRequest
from app.llm.client import OpenAiBackend, StructuredLlm
from app.pipeline.context import PipelineContext
from app.pipeline.factory import build_search
from app.pipeline.research import ResearchPipeline
from app.sources.fetch import Fetcher
from app.store.memory import MemoryStore

ICP = {
    "industries": [{"value": "B2B SaaS", "weight": 25}, {"value": "developer tools", "weight": 20}],
    "employee_range": {"min": 20, "max": 1000, "weight": 20},
    "geographies": [{"value": "United States", "weight": 10}, {"value": "EMEA", "weight": 10}],
    "titles": [{"keywords": ["head of growth", "vp sales", "cro", "founder"], "weight": 25}],
    "keyword_signals": [{"keyword": "sales", "weight": 10}, {"keyword": "outbound", "weight": 10}],
    "min_score_to_qualify": 60,
}


def show(result, ctx, args) -> None:  # type: ignore[no-untyped-def]
    c, o = result.company, result.outreach
    print(f"\n=== {c.name} ({c.domain}) ===")
    print(f"profile: industry={c.industry!r} band={c.employee_band!r} location={c.location!r}")
    print(f"description: {c.description!r}")
    print(
        f"ICP {result.icp.score} (confidence {result.icp.confidence}) qualified={result.qualified} | intent {result.intent.score}"
    )
    for w in result.why_fit:
        print(f"  fit[{w.status:<7}] {w.text}")
    print(
        f"signals: {[(s.type.value, 'V' if s.verified else 'unverified', s.title) for s in result.signals]}"
    )
    print(f"people: {[(p.name, p.title) for p in result.people][:4]}")
    by_status = {True: 0, False: 0}
    for e in result.evidence:
        by_status[e.verification.verified] += 1
    print(
        f"evidence: {by_status[True]} verified / {by_status[False]} unverified from {len({e.source_url for e in result.evidence})} URLs"
    )
    print("--- outreach ---")
    print(f"insufficient_evidence={o.insufficient_evidence}")
    for label, value in (
        ("why_contact", o.why_contact),
        ("why_now", o.why_now),
        ("why_person", o.why_person),
        ("potential_problem", o.potential_problem),
        ("recommended_angle", o.recommended_angle),
    ):
        print(f"  {label}: {value!r}")
    if o.evidence_ids:
        ev = {e.id: e for e in result.evidence}
        for eid in o.evidence_ids[:4]:
            print(f"    cites {eid}: {ev[eid].claim!r} <- {ev[eid].source_url}")
    print(f"unknowns={result.unknowns} warnings={result.warnings}")
    cost = sum(u.cost_estimate for u in ctx.usage)
    print(
        f"cost: pages={ctx.budget.pages} llm_calls={ctx.budget.llm_calls} est=${cost:.4f} elapsed={ctx.budget.elapsed():.0f}s"
    )


async def main(args: argparse.Namespace) -> int:
    settings = Settings()  # type: ignore[call-arg]
    if not settings.openai_api_key:
        print("OPENAI_API_KEY is not set", file=sys.stderr)
        return 1
    store = MemoryStore()
    fetcher = Fetcher(settings, store.limiter, store.cache)
    pipeline = ResearchPipeline(
        settings, fetcher, build_search(settings), StructuredLlm(OpenAiBackend(settings))
    )
    body: dict = {
        "idempotency_key": f"smoke-{args.domain}",
        "task": "lead_research" if args.lead else "company_research",
        "input": {"company": {"name": args.name or args.domain, "domain": args.domain}, "freshness_days": 0},
        "context": {
            "icp": ICP,
            "positioning": "We help B2B teams book more qualified meetings with automated prospect research and personalized outreach.",
            "offer_keywords": ["outbound", "sales", "SDR"],
        },
        "budgets": {
            "max_pages": 14,
            "max_llm_calls": 12,
            "max_search_queries": 4,
            "max_cost_usd": 0.40,
            "max_seconds": 150,
        },
    }
    if args.lead:
        body["input"]["lead"] = {"name": args.lead, "title": args.title}
    ctx = PipelineContext("smoke", RunRequest.model_validate(body))
    try:
        result = await pipeline.execute(ctx)
    finally:
        await fetcher.aclose()
    problems = check_invariants(result, ctx.docs.urls())
    if args.json:
        print(json.dumps(result.model_dump(mode="json"), indent=2, default=str))
    else:
        show(result, ctx, args)
    print("invariants:", problems or "OK")
    return 0 if not problems else 2


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("domain")
    ap.add_argument("name", nargs="?")
    ap.add_argument("--lead")
    ap.add_argument("--title")
    ap.add_argument("--json", action="store_true")
    raise SystemExit(asyncio.run(main(ap.parse_args())))
