"""Scripted LLM for tests. `FakeLlm` implements the same `LlmClient` protocol, so agents never know."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, TypeVar

from pydantic import BaseModel

from app.contracts.common import UsageItem
from app.pipeline.context import PipelineContext

T = TypeVar("T", bound=BaseModel)
Handler = Callable[[str, str], Any]  # (system, user) -> model instance | dict | Exception


class FakeLlm:
    """Register a handler per task: `fake.on("extract_company", lambda system, user: CompanyFacts(...))`.
    A handler may return a pydantic model, a dict (validated against the requested schema), or raise."""

    model = "fake-llm"

    def __init__(self) -> None:
        self._handlers: dict[str, Handler] = {}
        self.calls: list[tuple[str, str, str]] = []

    def on(self, task: str, handler: Handler | Any) -> FakeLlm:
        self._handlers[task] = handler if callable(handler) else _constant(handler)
        return self

    async def generate(
        self,
        ctx: PipelineContext,
        *,
        task: str,
        system: str,
        user: str,
        schema: type[T],
        model: str | None = None,
    ) -> T:
        ctx.check_cancelled()
        ctx.budget.spend_llm()
        self.calls.append((task, system, user))
        handler = self._handlers.get(task)
        if handler is None:
            raise AssertionError(f"FakeLlm has no handler for task {task!r}")
        async with ctx.step("llm", tool=task, input_summary=task) as out:
            ctx.add_usage(
                UsageItem(
                    kind="llm",
                    provider="fake",
                    model=self.model,
                    units=1,
                    tokens_in=100,
                    tokens_out=50,
                    cost_estimate=0.0005,
                )
            )
            out["tokens_in"], out["tokens_out"] = 100, 50
            value = handler(system, user)
            if isinstance(value, Exception):
                raise value
            return value if isinstance(value, schema) else schema.model_validate(value)

    def calls_for(self, task: str) -> list[tuple[str, str]]:
        return [(s, u) for t, s, u in self.calls if t == task]


def _constant(value: Any) -> Handler:
    def handler(_system: str, _user: str) -> Any:
        return value

    return handler
