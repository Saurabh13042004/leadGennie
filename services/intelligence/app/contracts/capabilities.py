from __future__ import annotations

from typing import Literal

from app.contracts.common import CONTRACT_VERSION, RunTask, StrictModel


class ConnectorStatus(StrictModel):
    name: str
    available: bool
    reason: str | None = None


class TaskCost(StrictModel):
    task: RunTask
    typical_llm_calls: int
    typical_pages: int
    typical_cost_usd: float


class Capabilities(StrictModel):
    contract_version: str = CONTRACT_VERSION
    fake_mode: bool = False
    tasks: list[RunTask]
    connectors: list[ConnectorStatus]
    task_costs: list[TaskCost]
    llm_model: str | None = None


class CapabilitiesResponse(StrictModel):
    ok: Literal[True] = True
    data: Capabilities


class HealthResponse(StrictModel):
    status: Literal["ok", "degraded"] = "ok"
    checks: dict[str, str] = {}
