from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from app.documents import RawDocument


@dataclass
class RunRecord:
    run_id: str
    idempotency_key: str
    task: str
    status: str
    request: dict[str, Any]
    input_hash: str
    progress: dict[str, Any] = field(default_factory=lambda: {"stage": "queued", "pct": 0})
    result: dict[str, Any] | None = None
    error: dict[str, Any] | None = None
    trace: list[dict[str, Any]] = field(default_factory=list)
    usage: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime | None = None
    updated_at: datetime | None = None
    finished_at: datetime | None = None


class RunStore(Protocol):
    async def create_or_get(
        self, run_id: str, idempotency_key: str, task: str, request: dict[str, Any], input_hash: str
    ) -> tuple[RunRecord, bool]: ...

    async def get(self, run_id: str) -> RunRecord | None: ...

    async def update(self, run_id: str, **fields: Any) -> RunRecord | None: ...

    async def list_unfinished(self) -> list[RunRecord]: ...

    async def purge_expired(self, retention_days: int) -> int: ...


class SourceCache(Protocol):
    async def get(self, url: str, max_age_seconds: float) -> RawDocument | None: ...

    async def put(self, doc: RawDocument, ttl_seconds: float) -> None: ...


class HostLimiter(Protocol):
    async def acquire(self, host: str, rps: float) -> None:
        """Return once this caller may send a request to `host`, respecting the shared per-host rate."""
        ...


class Store(Protocol):
    @property
    def runs(self) -> RunStore: ...

    @property
    def cache(self) -> SourceCache: ...

    @property
    def limiter(self) -> HostLimiter: ...

    async def ping(self) -> bool: ...

    async def close(self) -> None: ...
