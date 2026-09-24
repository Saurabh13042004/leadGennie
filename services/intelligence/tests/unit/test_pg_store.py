"""Postgres store integration. Needs a DISPOSABLE database:

docker run -d --rm -p 55432:5432 -e POSTGRES_PASSWORD=pw --name intel-pg postgres:16
INTEL_TEST_DATABASE_URL=postgresql://postgres:pw@localhost:55432/postgres uv run pytest -m pg
"""

import asyncio
import os
import time
from datetime import UTC, datetime, timedelta

import psycopg
import pytest
from app.documents import RawDocument
from app.store.postgres import PgStore, apply_migrations

pytestmark = pytest.mark.pg
DSN = os.environ.get("INTEL_TEST_DATABASE_URL", "")


@pytest.fixture
async def store():  # type: ignore[no-untyped-def]
    if not DSN:
        pytest.skip("INTEL_TEST_DATABASE_URL not set")
    async with await psycopg.AsyncConnection.connect(DSN, autocommit=True) as conn:
        await conn.execute("drop schema if exists intel cascade")
    await apply_migrations(DSN)
    s = await PgStore.connect(DSN)
    yield s
    await s.close()


async def test_migrations_are_idempotent_and_checksummed(store) -> None:  # type: ignore[no-untyped-def]
    assert await apply_migrations(DSN) == []  # second run is a no-op
    assert await store.ping()


async def test_runs_are_idempotent_and_updatable(store) -> None:  # type: ignore[no-untyped-def]
    a, created = await store.runs.create_or_get("run_a", "key-1", "lead_research", {"x": 1}, "h1")
    b, created_again = await store.runs.create_or_get("run_b", "key-1", "lead_research", {"x": 1}, "h1")
    assert created and not created_again and a.run_id == b.run_id == "run_a"
    assert [r.run_id for r in await store.runs.list_unfinished()] == ["run_a"]
    upd = await store.runs.update(
        "run_a",
        status="succeeded",
        result={"ok": True},
        trace=[{"seq": 1}],
        progress={"stage": "done", "pct": 100},
    )
    assert (
        upd is not None
        and upd.status == "succeeded"
        and upd.finished_at is not None
        and upd.result == {"ok": True}
    )
    assert await store.runs.list_unfinished() == []
    with pytest.raises(ValueError):
        await store.runs.update("run_a", idempotency_key="hack")


async def test_purge_removes_only_old_finished_runs(store) -> None:  # type: ignore[no-untyped-def]
    await store.runs.create_or_get("old", "k-old", "t", {}, "h")
    await store.runs.create_or_get("new", "k-new", "t", {}, "h")
    await store.runs.update("old", status="succeeded", finished_at=datetime.now(UTC) - timedelta(days=90))
    await store.runs.update("new", status="succeeded")
    await store.runs.purge_expired(30)
    assert await store.runs.get("old") is None and await store.runs.get("new") is not None


async def test_source_cache_respects_max_age(store) -> None:  # type: ignore[no-untyped-def]
    doc = RawDocument(
        url="https://a.example/", final_url="https://a.example/x", text="hello", html_hash="sha256:1"
    )
    await store.cache.put(doc, ttl_seconds=3600)
    hit = await store.cache.get("https://a.example/", max_age_seconds=60)
    assert (
        hit is not None
        and hit.text == "hello"
        and (await store.cache.get("https://a.example/x", 60)) is not None
    )
    assert await store.cache.get("https://missing.example/", 60) is None
    await asyncio.sleep(1.1)
    assert await store.cache.get("https://a.example/", max_age_seconds=1) is None  # too old for this caller


async def test_host_limiter_spaces_concurrent_requests_across_connections(store) -> None:  # type: ignore[no-untyped-def]
    started = time.monotonic()
    await asyncio.gather(*(store.limiter.acquire("slow.example", rps=4.0) for _ in range(5)))  # 0.25s apart
    elapsed = time.monotonic() - started
    assert 0.9 <= elapsed < 2.5, elapsed
    t0 = time.monotonic()
    await store.limiter.acquire("other.example", rps=4.0)  # a different host is independent
    assert time.monotonic() - t0 < 0.2


async def test_engine_restart_mid_run_resumes_the_run_from_postgres(store) -> None:  # type: ignore[no-untyped-def]
    """Kill the service while a run is executing; a fresh process resumes it from the persisted state."""
    from app.contracts.runs import RunRequest
    from app.fake.pipeline import FakePipeline
    from app.pipeline.service import RunService

    from tests.conftest import run_body

    req = RunRequest.model_validate(run_body("slow.example", name="Slow", key="restart-key-0001"))
    first = RunService(store.runs, FakePipeline(), max_concurrent=2)
    rec = await first.submit(req)
    await asyncio.sleep(0.3)  # the fake `slow.example` fixture is now mid-run
    await first.shutdown()  # simulated crash / deploy
    stuck = await store.runs.get(rec.run_id)
    assert stuck is not None and stuck.status in ("queued", "running")

    second = RunService(store.runs, FakePipeline(), max_concurrent=2)
    assert await second.recover() == 1
    await second.cancel(rec.run_id)  # don't wait 30s for the slow fixture
    for _ in range(50):
        view = await second.view(rec.run_id)
        assert view is not None
        if view.status.terminal:
            break
        await asyncio.sleep(0.1)
    assert view.status.value == "canceled"
    await second.shutdown()
