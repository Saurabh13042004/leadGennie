"""50 concurrent budgeted runs sharing one host: every run finishes, budgets hold, and the shared per-host
limiter keeps the crawl rate polite no matter how many runs are in flight."""

import asyncio
import time
from collections import defaultdict
from itertools import pairwise

import httpx
from app.contracts.invariants import check_invariants
from app.contracts.result import ResearchResult
from app.contracts.runs import RunRequest
from app.pipeline.research import ResearchPipeline
from app.pipeline.service import RunService
from app.sources.fetch import Fetcher
from app.store.memory import MemoryHostLimiter, MemoryRunStore, MemorySourceCache

from tests.harness import ICP, FakeSearch, acme_routes, scripted_llm
from tests.helpers import FakeResolver, make_settings, site_transport

RUNS, RPS = 50, 100.0


def body(i: int) -> RunRequest:
    return RunRequest.model_validate(
        {
            "idempotency_key": f"load-key-{i:04d}",
            "task": "lead_research",
            "input": {
                "company": {"name": "Acme", "domain": "acme.example", "location": "Bengaluru, India"},
                "lead": {"name": "Sarah Chen", "title": "VP Sales"},
                "freshness_days": 0,
            },
            "context": {
                "icp": ICP,
                "positioning": "We help outbound teams.",
                "offer_keywords": ["outbound", "SDR"],
            },
            "budgets": {"max_pages": 12, "max_llm_calls": 10, "max_seconds": 60},
        }
    )


async def test_fifty_concurrent_runs_complete_within_budgets_and_the_host_rate_limit() -> None:
    settings = make_settings(fetch_host_rps=RPS)
    transport = site_transport(acme_routes())
    fetcher = Fetcher(
        settings,
        MemoryHostLimiter(),
        MemorySourceCache(),
        client=httpx.AsyncClient(transport=transport),
        resolver=FakeResolver(),
    )
    pipeline = ResearchPipeline(settings, fetcher, FakeSearch(), scripted_llm())
    store = MemoryRunStore()
    service = RunService(store, pipeline, max_concurrent=12)

    started = time.monotonic()
    records = await asyncio.gather(*(service.submit(body(i)) for i in range(RUNS)))
    assert len({r.run_id for r in records}) == RUNS

    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        views = [await service.view(r.run_id) for r in records]
        if all(v and v.status.terminal for v in views):
            break
        await asyncio.sleep(0.1)
    elapsed = time.monotonic() - started
    await service.shutdown()

    assert all(v is not None and v.status.value == "succeeded" for v in views), [
        v.error for v in views if v and v.error
    ][:3]
    for v in views:
        assert v is not None and v.result is not None
        result = ResearchResult.model_validate(v.result)
        assert check_invariants(result) == [] and result.icp.score > 0
        assert (
            sum(1 for u in v.usage if u.kind == "fetch") <= 12 + 4
        )  # page budget (+ robots.txt lookups don't count as pages)
        assert sum(1 for u in v.usage if u.kind == "llm") <= 10

    # shared per-host rate limit: requests to one host are spaced >= ~1/RPS regardless of concurrency
    by_host: dict[str, list[float]] = defaultdict(list)
    for host, ts in transport.times:  # type: ignore[attr-defined]
        by_host[host].append(ts)
    for host, stamps in by_host.items():
        stamps.sort()
        gaps = [b - a for a, b in pairwise(stamps)]
        assert gaps and min(gaps) >= (1 / RPS) * 0.4, (
            host,
            min(gaps),
        )  # jitter between acquire() and the wire
        assert (len(stamps) - 1) / (stamps[-1] - stamps[0]) <= RPS * 1.05, (
            host
        )  # sustained rate never exceeds the cap
    total = sum(len(v) for v in by_host.values())
    print(
        f"\nload: runs={RUNS} requests={total} elapsed={elapsed:.1f}s effective_rps_max_host={max(len(v) for v in by_host.values()) / elapsed:.0f}"
    )
