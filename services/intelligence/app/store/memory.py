from __future__ import annotations

import asyncio
import copy
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from app.documents import RawDocument
from app.store.base import RunRecord


class MemoryRunStore:
    def __init__(self) -> None:
        self._runs: dict[str, RunRecord] = {}
        self._by_key: dict[str, str] = {}
        self._lock = asyncio.Lock()

    async def create_or_get(
        self, run_id: str, idempotency_key: str, task: str, request: dict[str, Any], input_hash: str
    ) -> tuple[RunRecord, bool]:
        async with self._lock:
            existing_id = self._by_key.get(idempotency_key)
            if existing_id:
                return copy.deepcopy(self._runs[existing_id]), False
            now = datetime.now(UTC)
            rec = RunRecord(
                run_id=run_id,
                idempotency_key=idempotency_key,
                task=task,
                status="queued",
                request=request,
                input_hash=input_hash,
                created_at=now,
                updated_at=now,
            )
            self._runs[run_id] = rec
            self._by_key[idempotency_key] = run_id
            return copy.deepcopy(rec), True

    async def get(self, run_id: str) -> RunRecord | None:
        rec = self._runs.get(run_id)
        return copy.deepcopy(rec) if rec else None

    async def update(self, run_id: str, **fields: Any) -> RunRecord | None:
        async with self._lock:
            rec = self._runs.get(run_id)
            if rec is None:
                return None
            for key, value in fields.items():
                setattr(rec, key, value)
            rec.updated_at = datetime.now(UTC)
            if fields.get("status") in ("succeeded", "failed", "canceled") and rec.finished_at is None:
                rec.finished_at = rec.updated_at
            return copy.deepcopy(rec)

    async def list_unfinished(self) -> list[RunRecord]:
        return [copy.deepcopy(r) for r in self._runs.values() if r.status in ("queued", "running")]

    async def purge_expired(self, retention_days: int) -> int:
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)
        stale = [rid for rid, r in self._runs.items() if r.finished_at and r.finished_at < cutoff]
        for rid in stale:
            rec = self._runs.pop(rid)
            self._by_key.pop(rec.idempotency_key, None)
        return len(stale)


class MemorySourceCache:
    def __init__(self) -> None:
        self._docs: dict[str, tuple[float, RawDocument]] = {}

    async def get(self, url: str, max_age_seconds: float) -> RawDocument | None:
        entry = self._docs.get(url)
        if not entry:
            return None
        stored_at, doc = entry
        if time.time() - stored_at > max_age_seconds:
            return None
        return doc.model_copy(deep=True)

    async def put(self, doc: RawDocument, ttl_seconds: float) -> None:
        self._docs[doc.url] = (time.time(), doc.model_copy(deep=True))
        if doc.final_url != doc.url:
            self._docs[doc.final_url] = (time.time(), doc.model_copy(deep=True))


class MemoryHostLimiter:
    """Single-process per-host spacing. Slots are reserved up-front (fair ordering), and the ACTUAL last-send
    time is tracked too, so event-loop jitter under load can never bunch two requests closer than the interval.
    The Postgres limiter shares the budget across replicas."""

    def __init__(self) -> None:
        self._next: dict[str, float] = {}
        self._last: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, host: str, rps: float) -> None:
        if rps <= 0:
            return
        interval = 1.0 / rps
        async with self._lock:
            slot = max(time.monotonic(), self._next.get(host, 0.0))
            self._next[host] = slot + interval
        delay = slot - time.monotonic()
        if delay > 0:
            await asyncio.sleep(delay)
        while True:  # no awaits between the final check and recording the send: atomic in the event loop
            wait = self._last.get(host, 0.0) + interval * 0.98 - time.monotonic()
            if wait <= 0:
                self._last[host] = time.monotonic()
                return
            await asyncio.sleep(wait)


class MemoryStore:
    def __init__(self) -> None:
        self.runs = MemoryRunStore()
        self.cache = MemorySourceCache()
        self.limiter = MemoryHostLimiter()

    async def ping(self) -> bool:
        return True

    async def close(self) -> None:
        return None
