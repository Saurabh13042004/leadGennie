from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

CONTRACT_VERSION = "1.0"
SCHEMA_VERSION = "1"


class StrictModel(BaseModel):
    """Base for every contract model: unknown fields are rejected, not ignored."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class SourceType(StrEnum):
    WEBSITE = "website"
    CAREERS = "careers"
    NEWS = "news"
    SEARCH = "search"
    JOBS_BOARD = "jobs_board"
    PRESS_RELEASE = "press_release"
    PUBLIC_DATA = "public_data"


class SignalType(StrEnum):
    FUNDING = "FUNDING"
    HIRING = "HIRING"
    EXPANSION = "EXPANSION"
    PRODUCT_LAUNCH = "PRODUCT_LAUNCH"
    LEADERSHIP_CHANGE = "LEADERSHIP_CHANGE"
    TECH_CHANGE = "TECH_CHANGE"
    JOB_POSTING = "JOB_POSTING"
    NEWS = "NEWS"


class RunTask(StrEnum):
    COMPANY_RESEARCH = "company_research"
    LEAD_RESEARCH = "lead_research"
    FIND_SIGNALS = "find_signals"


class RunStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELED = "canceled"

    @property
    def terminal(self) -> bool:
        return self in (RunStatus.SUCCEEDED, RunStatus.FAILED, RunStatus.CANCELED)


class ErrorCode(StrEnum):
    VALIDATION = "VALIDATION"
    UNAUTHENTICATED = "UNAUTHENTICATED"
    NOT_FOUND = "NOT_FOUND"
    RATE_LIMITED = "RATE_LIMITED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    PROVIDER_ERROR = "PROVIDER_ERROR"
    BUDGET_EXCEEDED = "BUDGET_EXCEEDED"
    TIMEOUT = "TIMEOUT"
    UNAVAILABLE = "UNAVAILABLE"
    INTERNAL = "INTERNAL"


class ApiError(StrictModel):
    code: ErrorCode
    message: str
    details: Any | None = None
    retryable: bool = False


class ErrEnvelope(StrictModel):
    ok: Literal[False] = False
    error: ApiError


class UsageItem(StrictModel):
    kind: Literal["llm", "search", "fetch", "provider"]
    provider: str
    model: str | None = None
    units: float = 1.0
    tokens_in: int = 0
    tokens_out: int = 0
    cost_estimate: float = 0.0


class TraceStep(StrictModel):
    seq: int
    stage: str
    agent: str | None = None
    tool: str | None = None
    started_at: datetime
    duration_ms: int
    status: Literal["ok", "error", "skipped"]
    input_summary: str = ""
    output_summary: str = ""
    tokens_in: int = 0
    tokens_out: int = 0
    error: str | None = None


class Progress(StrictModel):
    stage: str = "queued"
    pct: int = Field(default=0, ge=0, le=100)


STAGES: tuple[str, ...] = (
    "collecting",
    "extracting",
    "researching",
    "signals",
    "validating",
    "scoring",
    "outreach",
)
