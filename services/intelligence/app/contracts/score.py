from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.contracts.common import SignalType, StrictModel
from app.contracts.icp import Icp
from app.contracts.result import IcpResult, IntentResult, WhyFitItem


class ScoreCompany(StrictModel):
    industry: str | None = None
    country: str | None = None
    employee_count: int | None = Field(default=None, ge=0)
    domain: str | None = None
    keywords_found: list[str] = Field(default_factory=list)


class ScorePerson(StrictModel):
    title: str | None = None


class ScoreSignal(StrictModel):
    id: str | None = None
    type: SignalType
    confidence: float = Field(ge=0, le=1)
    detected_at: date | datetime | None = None
    verified: bool = True


class ScoreRequest(StrictModel):
    """Pure scoring. Inputs are the caller's *verified* attributes; unverified signals are ignored."""

    icp: Icp
    company: ScoreCompany = Field(default_factory=ScoreCompany)
    person: ScorePerson | None = None
    signals: list[ScoreSignal] = Field(default_factory=list)
    # attribute name -> evidence ids, only used to link the breakdown back to evidence
    evidence: dict[str, list[str]] = Field(default_factory=dict)
    as_of: date | None = None


class ScoreData(StrictModel):
    scoring_version: str
    icp: IcpResult
    intent: IntentResult
    qualified: bool
    why_fit: list[WhyFitItem] = Field(default_factory=list)


class ScoreResponse(StrictModel):
    ok: Literal[True] = True
    data: ScoreData
