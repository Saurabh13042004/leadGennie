"""Budget-limited REAL run against a public site: `make smoke DOMAIN=example.com NAME="Example"`.

Uses the in-process pipeline (no HTTP server) with the real fetcher, real OpenAI (OPENAI_API_KEY) and the search
provider if configured. Prints the verified result, the trace and the estimated cost. Costs a few cents."""

from __future__ import annotations

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


async def main(domain: str, name: str) -> int:
    settings = Settings()  # type: ignore[call-arg]
    if not settings.openai_api_key:
        print("OPENAI_API_KEY is not set (put it in .env)", file=sys.stderr)
        return 1
    store = MemoryStore()
    fetcher = Fetcher(settings, store.limiter, store.cache)
    pipeline = ResearchPipeline(
        settings, fetcher, build_search(settings), StructuredLlm(OpenAiBackend(settings))
    )
    req = RunRequest.model_validate(
        {
            "idempotency_key": "smoke-run-0001",
            "task": "company_research",
            "input": {"company": {"name": name, "domain": domain}},
            "context": {
                "positioning": "We help B2B teams book more qualified meetings.",
                "offer_keywords": ["outbound", "sales"],
            },
            "budgets": {
                "max_pages": 12,
                "max_llm_calls": 10,
                "max_search_queries": 4,
                "max_cost_usd": 0.30,
                "max_seconds": 120,
            },
        }
    )
    ctx = PipelineContext("smoke", req)
    try:
        result = await pipeline.execute(ctx)
    finally:
        await fetcher.aclose()
    print(json.dumps(result.model_dump(mode="json"), indent=2, default=str)[:12000])
    problems = check_invariants(result, ctx.docs.urls())
    print("\n--- trace ---")
    for t in ctx.trace:
        print(
            f"{t.seq:>2} {t.stage:<11} {t.tool or '':<18} {t.duration_ms:>6} ms  {t.status:<7} {t.output_summary}"
        )
    cost = sum(u.cost_estimate for u in ctx.usage)
    print(
        f"\npages={ctx.budget.pages} llm_calls={ctx.budget.llm_calls} est_cost=${cost:.4f} warnings={ctx.warnings}"
    )
    print("invariants:", problems or "OK")
    return 0 if not problems else 2


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("usage: smoke.py DOMAIN [NAME]", file=sys.stderr)
        raise SystemExit(1)
    raise SystemExit(asyncio.run(main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else sys.argv[1])))
