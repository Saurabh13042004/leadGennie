from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from app.config import Settings
from app.contracts.validate import ValidateData, ValidateRequest
from app.pipeline.service import Executor, RunService
from app.store.base import Store
from app.store.memory import MemoryStore


@dataclass
class Container:
    settings: Settings
    store: Store
    executor: Executor
    runs: RunService
    llm_model: str | None = None
    connectors: list[dict[str, Any]] | None = None
    validate_claims: Callable[[ValidateRequest], Awaitable[ValidateData]] | None = None


async def build_container(
    settings: Settings, *, store: Store | None = None, executor: Executor | None = None
) -> Container:
    """Wire the object graph. Dependencies are injected so tests can substitute fakes (DIP)."""
    active: Store
    if store is not None:
        active = store
    elif settings.intel_database_url:
        from app.store.postgres import PgStore

        active = await PgStore.connect(settings.intel_database_url)
    else:
        active = MemoryStore()

    llm_model: str | None = None
    connectors: list[dict[str, Any]] = []
    validate_fn: Callable[[ValidateRequest], Awaitable[ValidateData]] | None = None
    if executor is None:
        if settings.engine_fake_mode:
            from app.fake.pipeline import FakePipeline

            executor = FakePipeline()
            connectors = [{"name": "fake", "available": True, "reason": "ENGINE_FAKE_MODE"}]
        else:
            from app.pipeline.factory import build_real_pipeline

            executor, llm_model, connectors, validate_fn = build_real_pipeline(settings, active)
    runs = RunService(active.runs, executor, settings.max_concurrent_runs)
    return Container(settings, active, executor, runs, llm_model, connectors, validate_fn)
