from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any

from app.contracts.common import STAGES, TraceStep, UsageItem
from app.contracts.runs import Budgets, RunRequest
from app.documents import DocumentSet
from app.errors import EngineError


class BudgetExhausted(Exception):
    """A hard budget was reached. The pipeline catches this and returns a partial result + warning."""

    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason


class RunCanceled(Exception):
    pass


class Budget:
    """Checked *before* every external call (`spend_*`), so a run can never overrun silently."""

    def __init__(self, limits: Budgets) -> None:
        self.limits = limits
        self._started = time.monotonic()
        self.pages = 0
        self.searches = 0
        self.llm_calls = 0
        self.cost_usd = 0.0

    def elapsed(self) -> float:
        return time.monotonic() - self._started

    def check_time(self) -> None:
        if self.elapsed() >= self.limits.max_seconds:
            raise BudgetExhausted("max_seconds")

    def spend_page(self) -> None:
        self.check_time()
        if self.pages >= self.limits.max_pages:
            raise BudgetExhausted("max_pages")
        self.pages += 1

    def spend_search(self) -> None:
        self.check_time()
        if self.searches >= self.limits.max_search_queries:
            raise BudgetExhausted("max_search_queries")
        self.searches += 1

    def spend_llm(self) -> None:
        self.check_time()
        if self.llm_calls >= self.limits.max_llm_calls:
            raise BudgetExhausted("max_llm_calls")
        if self.cost_usd >= self.limits.max_cost_usd:
            raise BudgetExhausted("max_cost_usd")
        self.llm_calls += 1

    def add_cost(self, usd: float) -> None:
        self.cost_usd += usd

    def can_llm(self) -> bool:
        return (
            self.llm_calls < self.limits.max_llm_calls
            and self.cost_usd < self.limits.max_cost_usd
            and self.elapsed() < self.limits.max_seconds
        )


ProgressCallback = Callable[[str, int], Awaitable[None]]


class PipelineContext:
    """Everything one run needs: request, budget, captured documents, trace, usage, cancellation."""

    def __init__(self, run_id: str, request: RunRequest, on_progress: ProgressCallback | None = None) -> None:
        self.run_id = run_id
        self.request = request
        self.budget = Budget(request.budgets)
        self.docs = DocumentSet()
        self.trace: list[TraceStep] = []
        self.usage: list[UsageItem] = []
        self.warnings: list[str] = []
        self.cancel_event = asyncio.Event()
        self._on_progress = on_progress
        self._seq = 0

    def warn(self, message: str) -> None:
        if message not in self.warnings:
            self.warnings.append(message)

    def check_cancelled(self) -> None:
        if self.cancel_event.is_set():
            raise RunCanceled()

    async def progress(self, stage: str) -> None:
        self.check_cancelled()
        if self._on_progress:
            idx = STAGES.index(stage) if stage in STAGES else 0
            await self._on_progress(stage, int(idx / len(STAGES) * 100))

    def add_usage(self, item: UsageItem) -> None:
        self.usage.append(item)
        self.budget.add_cost(item.cost_estimate)

    @asynccontextmanager
    async def step(
        self, stage: str, *, agent: str | None = None, tool: str | None = None, input_summary: str = ""
    ) -> AsyncIterator[dict[str, Any]]:
        """Record one unit of work in the trace. Yields a dict the caller can fill with `output_summary`,
        `tokens_in`, `tokens_out`."""
        self._seq += 1
        seq = self._seq
        started = datetime.now(UTC)
        t0 = time.monotonic()
        out: dict[str, Any] = {}
        status = "ok"
        error: str | None = None
        try:
            yield out
        except (BudgetExhausted, RunCanceled):
            status = "skipped"
            raise
        except EngineError as exc:
            status, error = "error", f"{exc.code}: {exc.message}"
            raise
        except Exception as exc:
            status, error = "error", type(exc).__name__
            raise
        finally:
            self.trace.append(
                TraceStep(
                    seq=seq,
                    stage=stage,
                    agent=agent,
                    tool=tool,
                    started_at=started,
                    duration_ms=int((time.monotonic() - t0) * 1000),
                    status=status,
                    input_summary=input_summary[:300],
                    output_summary=str(out.get("output_summary", ""))[:300],
                    tokens_in=int(out.get("tokens_in", 0) or 0),
                    tokens_out=int(out.get("tokens_out", 0) or 0),
                    error=error,
                )
            )
