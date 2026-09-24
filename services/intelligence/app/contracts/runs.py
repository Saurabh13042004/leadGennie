from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.contracts.common import (
    ApiError,
    Progress,
    RunStatus,
    RunTask,
    StrictModel,
    TraceStep,
    UsageItem,
)
from app.contracts.icp import Icp
from app.contracts.result import ResearchResult


class Budgets(StrictModel):
    """Hard limits. On exhaustion the run finishes gracefully with a partial result + a warning."""

    max_seconds: int = Field(default=120, ge=5, le=900)
    max_pages: int = Field(default=25, ge=1, le=100)
    max_search_queries: int = Field(default=8, ge=0, le=30)
    max_llm_calls: int = Field(default=12, ge=1, le=60)
    max_cost_usd: float = Field(default=0.60, gt=0, le=10.0)


class CompanyInput(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    domain: str | None = Field(default=None, max_length=253)
    linkedin_url: str | None = None
    location: str | None = None


class LeadInput(StrictModel):
    name: str = Field(min_length=1, max_length=200)
    title: str | None = None
    linkedin_url: str | None = None


class RunInput(StrictModel):
    company: CompanyInput
    lead: LeadInput | None = None
    questions: list[str] | None = None
    freshness_days: int = Field(default=14, ge=0, le=365)


class RunContext(StrictModel):
    """Workspace context as DATA. The engine has no notion of workspace identity."""

    icp: Icp = Field(default_factory=Icp)
    positioning: str = Field(default="", max_length=4000)
    offer_keywords: list[str] = Field(default_factory=list, max_length=30)
    locale: str = "en"


class RunRequest(StrictModel):
    idempotency_key: str = Field(min_length=8, max_length=200)
    task: RunTask
    input: RunInput
    context: RunContext = Field(default_factory=RunContext)
    budgets: Budgets = Field(default_factory=Budgets)


class RunCreated(StrictModel):
    run_id: str
    status: RunStatus


class RunCreatedResponse(StrictModel):
    ok: Literal[True] = True
    data: RunCreated


class RunView(StrictModel):
    run_id: str
    status: RunStatus
    progress: Progress = Field(default_factory=Progress)
    result: ResearchResult | None = None
    error: ApiError | None = None
    trace: list[TraceStep] = Field(default_factory=list)
    usage: list[UsageItem] = Field(default_factory=list)


class RunViewResponse(StrictModel):
    ok: Literal[True] = True
    data: RunView
