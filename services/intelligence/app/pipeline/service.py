from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from typing import Any, Protocol

from app.contracts.common import ApiError, ErrorCode, Progress, RunStatus, TraceStep, UsageItem
from app.contracts.invariants import check_invariants
from app.contracts.result import ResearchResult
from app.contracts.runs import RunRequest, RunView
from app.errors import EngineError
from app.pipeline.context import BudgetExhausted, PipelineContext, RunCanceled
from app.store.base import RunRecord, RunStore
from app.telemetry.logging import get_logger

log = get_logger(__name__)


class Executor(Protocol):
    """Runs one research task. The real implementation is `ResearchPipeline`; `FakePipeline` serves dev/tests."""

    async def execute(self, ctx: PipelineContext) -> ResearchResult: ...


def hash_request(req: RunRequest) -> str:
    payload = json.dumps(req.model_dump(mode="json", exclude={"idempotency_key"}), sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


class RunService:
    """Idempotent async runs: submit → background execution → poll. State lives in the RunStore, so a
    restarted engine resumes unfinished runs and a retryable failure can be resubmitted with the same key."""

    def __init__(self, store: RunStore, executor: Executor, max_concurrent: int = 4) -> None:
        self._store = store
        self._executor = executor
        self._sem = asyncio.Semaphore(max_concurrent)
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._contexts: dict[str, PipelineContext] = {}
        self._cancel_requested: set[str] = set()  # cancel arrived before the run's context existed

    # -- public API ---------------------------------------------------------------------------------

    async def submit(self, req: RunRequest) -> RunRecord:
        run_id = f"run_{uuid.uuid4().hex[:20]}"
        input_hash = hash_request(req)
        rec, created = await self._store.create_or_get(
            run_id, req.idempotency_key, req.task.value, req.model_dump(mode="json"), input_hash
        )
        if created:
            self._start(rec.run_id, req)
            return rec
        if rec.input_hash != input_hash:
            log.warning("idempotency_key_reused_with_different_input", run_id=rec.run_id)
        if rec.status == RunStatus.FAILED and (rec.error or {}).get("retryable"):
            restarted = await self._store.update(
                rec.run_id,
                status="queued",
                error=None,
                result=None,
                trace=[],
                usage=[],
                progress={"stage": "queued", "pct": 0},
                finished_at=None,
            )
            self._start(rec.run_id, req)
            return restarted or rec
        return rec

    async def view(self, run_id: str) -> RunView | None:
        rec = await self._store.get(run_id)
        return self._to_view(rec) if rec else None

    async def cancel(self, run_id: str) -> RunView | None:
        rec = await self._store.get(run_id)
        if rec is None:
            return None
        if RunStatus(rec.status).terminal:
            return self._to_view(rec)
        ctx = self._contexts.get(run_id)
        if ctx:
            ctx.cancel_event.set()
        elif run_id in self._tasks:
            # Scheduled here but not started yet: record the intent; `_run` honors it before doing any work.
            # (Writing "canceled" to the store now would race with `_run` marking the run "running".)
            self._cancel_requested.add(run_id)
        else:
            rec = await self._store.update(run_id, status="canceled") or rec
        return self._to_view(rec)

    async def recover(self) -> int:
        """On startup, resume runs left unfinished by a previous process (the source cache makes this cheap)."""
        resumed = 0
        for rec in await self._store.list_unfinished():
            req = RunRequest.model_validate(rec.request)
            await self._store.update(rec.run_id, status="queued", progress={"stage": "queued", "pct": 0})
            self._start(rec.run_id, req)
            resumed += 1
        return resumed

    async def shutdown(self) -> None:
        for ctx in self._contexts.values():
            ctx.cancel_event.set()
        tasks = list(self._tasks.values())
        for t in tasks:
            t.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    # -- internals ----------------------------------------------------------------------------------

    def _start(self, run_id: str, req: RunRequest) -> None:
        task = asyncio.create_task(self._run(run_id, req), name=f"run:{run_id}")
        self._tasks[run_id] = task

        def _forget(_task: asyncio.Task[None]) -> None:
            self._tasks.pop(run_id, None)

        task.add_done_callback(_forget)

    async def _run(self, run_id: str, req: RunRequest) -> None:
        async with self._sem:
            current = await self._store.get(run_id)
            if current is None or RunStatus(current.status).terminal:
                return

            async def on_progress(stage: str, pct: int) -> None:
                await self._store.update(run_id, progress={"stage": stage, "pct": pct})

            ctx = PipelineContext(run_id, req, on_progress)
            self._contexts[run_id] = ctx
            if run_id in self._cancel_requested:
                self._cancel_requested.discard(run_id)
                ctx.cancel_event.set()
            await self._store.update(run_id, status="running")
            fields: dict[str, Any]
            try:
                async with asyncio.timeout(req.budgets.max_seconds + 30):
                    result = await self._executor.execute(ctx)
                # The fetched-URL rule applies whenever anything was fetched (the fake pipeline fetches nothing).
                problems = check_invariants(result, ctx.docs.urls() if len(ctx.docs) else None)
                if problems:
                    log.error("contract_invariant_violation", run_id=run_id, problems=problems[:10])
                    raise EngineError(
                        ErrorCode.INTERNAL,
                        "Result violated contract invariants",
                        details=problems[:10],
                        retryable=False,
                    )
                if ctx.warnings:
                    result.warnings = list(dict.fromkeys([*result.warnings, *ctx.warnings]))
                fields = {
                    "status": "succeeded",
                    "result": result.model_dump(mode="json"),
                    "progress": {"stage": "done", "pct": 100},
                    "error": None,
                }
            except RunCanceled:
                fields = {"status": "canceled"}
            except BudgetExhausted as exc:  # only if the pipeline did not degrade gracefully itself
                fields = {
                    "status": "failed",
                    "error": ApiError(
                        code=ErrorCode.BUDGET_EXCEEDED,
                        message=f"Budget exhausted before a usable result: {exc.reason}",
                        retryable=False,
                    ).model_dump(mode="json"),
                }
            except TimeoutError:
                fields = {
                    "status": "failed",
                    "error": ApiError(
                        code=ErrorCode.TIMEOUT, message="Run exceeded its time budget", retryable=True
                    ).model_dump(mode="json"),
                }
            except EngineError as exc:
                fields = {"status": "failed", "error": exc.to_api_error().model_dump(mode="json")}
            except asyncio.CancelledError:
                # engine shutting down: leave the run resumable
                await self._store.update(run_id, status="queued")
                raise
            except Exception as exc:
                log.exception("run_failed", run_id=run_id)
                fields = {
                    "status": "failed",
                    "error": ApiError(
                        code=ErrorCode.INTERNAL,
                        message=f"Unexpected error: {type(exc).__name__}",
                        retryable=True,
                    ).model_dump(mode="json"),
                }
            finally:
                self._contexts.pop(run_id, None)
            fields["trace"] = [t.model_dump(mode="json") for t in ctx.trace]
            fields["usage"] = [u.model_dump(mode="json") for u in ctx.usage]
            await self._store.update(run_id, **fields)
            log.info(
                "run_finished",
                run_id=run_id,
                status=fields["status"],
                elapsed_s=round(ctx.budget.elapsed(), 2),
            )

    @staticmethod
    def _to_view(rec: RunRecord) -> RunView:
        return RunView(
            run_id=rec.run_id,
            status=RunStatus(rec.status),
            progress=Progress.model_validate(rec.progress),
            result=ResearchResult.model_validate(rec.result) if rec.result else None,
            error=ApiError.model_validate(rec.error) if rec.error else None,
            trace=[TraceStep.model_validate(t) for t in rec.trace],
            usage=[UsageItem.model_validate(u) for u in rec.usage],
        )
