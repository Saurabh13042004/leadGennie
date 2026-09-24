from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from psycopg_pool import AsyncConnectionPool

from app.documents import RawDocument
from app.store.base import RunRecord

MIGRATIONS_DIR = Path(__file__).resolve().parents[2] / "migrations"

_COLUMNS = "run_id, idempotency_key, task, status, progress, request, input_hash, result, error, trace, usage, created_at, updated_at, finished_at"
_JSON_FIELDS = {"progress", "request", "result", "error", "trace", "usage"}
_UPDATABLE = _JSON_FIELDS | {"status", "finished_at"}


def _record(row: dict[str, Any]) -> RunRecord:
    return RunRecord(**{k: row[k] for k in RunRecord.__dataclass_fields__})


class PgRunStore:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def create_or_get(
        self, run_id: str, idempotency_key: str, task: str, request: dict[str, Any], input_hash: str
    ) -> tuple[RunRecord, bool]:
        async with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                f"""insert into intel.runs (run_id, idempotency_key, task, request, input_hash)
                    values (%s, %s, %s, %s, %s)
                    on conflict (idempotency_key) do nothing
                    returning {_COLUMNS}""",
                (run_id, idempotency_key, task, Jsonb(request), input_hash),
            )
            row = await cur.fetchone()
            if row:
                return _record(row), True
            await cur.execute(
                f"select {_COLUMNS} from intel.runs where idempotency_key = %s", (idempotency_key,)
            )
            existing = await cur.fetchone()
            assert existing is not None
            return _record(existing), False

    async def get(self, run_id: str) -> RunRecord | None:
        async with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(f"select {_COLUMNS} from intel.runs where run_id = %s", (run_id,))
            row = await cur.fetchone()
            return _record(row) if row else None

    async def update(self, run_id: str, **fields: Any) -> RunRecord | None:
        unknown = set(fields) - _UPDATABLE
        if unknown:
            raise ValueError(f"cannot update fields: {sorted(unknown)}")
        if fields.get("status") in ("succeeded", "failed", "canceled"):
            fields.setdefault("finished_at", datetime.now(UTC))
        if not fields:
            return await self.get(run_id)
        sets = ", ".join(f"{k} = %s" for k in fields)
        values = [Jsonb(v) if k in _JSON_FIELDS and v is not None else v for k, v in fields.items()]
        async with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                f"update intel.runs set {sets}, updated_at = now() where run_id = %s returning {_COLUMNS}",
                (*values, run_id),
            )
            row = await cur.fetchone()
            return _record(row) if row else None

    async def list_unfinished(self) -> list[RunRecord]:
        async with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(f"select {_COLUMNS} from intel.runs where status in ('queued','running')")
            return [_record(r) for r in await cur.fetchall()]

    async def purge_expired(self, retention_days: int) -> int:
        async with self._pool.connection() as conn, conn.cursor() as cur:
            await cur.execute(
                "delete from intel.runs where finished_at is not null and finished_at < now() - make_interval(days => %s)",
                (retention_days,),
            )
            await cur.execute("delete from intel.source_cache where expires_at < now()")
            return cur.rowcount or 0


class PgSourceCache:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def get(self, url: str, max_age_seconds: float) -> RawDocument | None:
        async with self._pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                """select doc from intel.source_cache
                   where url = %s and expires_at > now()
                     and stored_at > now() - make_interval(secs => %s)""",
                (url, max_age_seconds),
            )
            row = await cur.fetchone()
            return RawDocument.model_validate(row["doc"]) if row else None

    async def put(self, doc: RawDocument, ttl_seconds: float) -> None:
        payload = Jsonb(doc.model_dump(mode="json"))
        async with self._pool.connection() as conn, conn.cursor() as cur:
            for url in {doc.url, doc.final_url}:
                await cur.execute(
                    """insert into intel.source_cache (url, doc, stored_at, expires_at)
                       values (%s, %s, now(), now() + make_interval(secs => %s))
                       on conflict (url) do update
                       set doc = excluded.doc, stored_at = now(), expires_at = excluded.expires_at""",
                    (url, payload, ttl_seconds),
                )


class PgHostLimiter:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool

    async def acquire(self, host: str, rps: float) -> None:
        if rps <= 0:
            return
        import asyncio

        interval = 1.0 / rps
        async with self._pool.connection() as conn, conn.cursor() as cur:
            await cur.execute(
                """with claimed as (
                     insert into intel.host_limits (host, next_allowed_at)
                     values (%(h)s, now() + make_interval(secs => %(i)s))
                     on conflict (host) do update
                       set next_allowed_at = greatest(now(), intel.host_limits.next_allowed_at)
                                             + make_interval(secs => %(i)s)
                     returning next_allowed_at - make_interval(secs => %(i)s) as slot
                   )
                   select greatest(0, extract(epoch from (slot - now()))) from claimed""",
                {"h": host, "i": interval},
            )
            row = await cur.fetchone()
        delay = float(row[0]) if row else 0.0
        if delay > 0:
            await asyncio.sleep(delay)


class PgStore:
    def __init__(self, pool: AsyncConnectionPool) -> None:
        self._pool = pool
        self.runs = PgRunStore(pool)
        self.cache = PgSourceCache(pool)
        self.limiter = PgHostLimiter(pool)

    @classmethod
    async def connect(cls, dsn: str) -> PgStore:
        pool = AsyncConnectionPool(dsn, min_size=1, max_size=10, open=False, kwargs={"autocommit": True})
        await pool.open(wait=True, timeout=15)
        return cls(pool)

    async def ping(self) -> bool:
        try:
            async with self._pool.connection() as conn:
                await conn.execute("select 1")
            return True
        except psycopg.Error:
            return False

    async def close(self) -> None:
        await self._pool.close()


async def apply_migrations(dsn: str) -> list[str]:
    """Apply pending `migrations/*.sql` in order, recording checksums. Run with a privileged role once;
    the runtime role only needs access to the `intel` schema."""
    applied: list[str] = []
    async with await psycopg.AsyncConnection.connect(dsn, autocommit=True) as conn:
        await conn.execute("create schema if not exists intel")
        await conn.execute(
            """create table if not exists intel.schema_migrations (
                 version text primary key, checksum text not null, applied_at timestamptz not null default now())"""
        )
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            sql_text = path.read_text()
            checksum = hashlib.sha256(sql_text.encode()).hexdigest()
            cur = await conn.execute(
                "select checksum from intel.schema_migrations where version = %s", (path.name,)
            )
            row = await cur.fetchone()
            if row:
                if row[0] != checksum:
                    raise RuntimeError(f"migration {path.name} was modified after being applied")
                continue
            async with conn.transaction():
                await conn.execute(sql_text)
                await conn.execute(
                    "insert into intel.schema_migrations (version, checksum) values (%s, %s)",
                    (path.name, checksum),
                )
            applied.append(path.name)
    return applied
