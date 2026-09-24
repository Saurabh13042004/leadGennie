from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import Field

from app.contracts.common import SCHEMA_VERSION, SignalType, SourceType, StrictModel


class Verification(StrictModel):
    verified: bool
    confidence: float = Field(ge=0, le=1)
    method: list[str] = Field(default_factory=list)
    checked_at: datetime
    notes: list[str] = Field(default_factory=list)


class Evidence(StrictModel):
    id: str
    claim: str
    source_url: str
    source_title: str | None = None
    source_type: SourceType
    snippet: str
    content_hash: str
    captured_at: datetime
    verification: Verification


class FieldValue(StrictModel):
    field: str
    value: str
    evidence_ids: list[str] = Field(default_factory=list)


class CompanyProfile(StrictModel):
    name: str
    domain: str | None = None
    industry: str | None = None
    employee_band: str | None = None
    location: str | None = None
    description: str | None = None
    products: list[str] = Field(default_factory=list)
    market: str | None = None
    business_model: str | None = None
    fields: list[FieldValue] = Field(default_factory=list)


class Person(StrictModel):
    name: str
    title: str | None = None
    relevance: str = ""
    evidence_ids: list[str] = Field(default_factory=list)


class Signal(StrictModel):
    id: str
    type: SignalType
    title: str
    description: str = ""
    detected_at: date | None = None
    confidence: float = Field(ge=0, le=1)
    verified: bool
    evidence_ids: list[str] = Field(default_factory=list)
    conflicts_with: list[str] = Field(default_factory=list)


class IcpBreakdownItem(StrictModel):
    criterion: str
    status: Literal["met", "partial", "not_met", "unknown"]
    weight: float
    points: float
    value_found: str | None = None
    evidence_ids: list[str] = Field(default_factory=list)


class IcpResult(StrictModel):
    score: int = Field(ge=0, le=100)
    confidence: float = Field(ge=0, le=1)
    breakdown: list[IcpBreakdownItem] = Field(default_factory=list)


class IntentBreakdownItem(StrictModel):
    signal_id: str | None = None
    signal_type: SignalType | None = None
    weight: float
    confidence: float
    recency_factor: float
    points: float


class IntentResult(StrictModel):
    score: int = Field(ge=0, le=100)
    breakdown: list[IntentBreakdownItem] = Field(default_factory=list)


class WhyFitItem(StrictModel):
    criterion: str
    status: Literal["met", "partial", "not_met", "unknown"]
    text: str
    evidence_ids: list[str] = Field(default_factory=list)


class Outreach(StrictModel):
    insufficient_evidence: bool = False
    why_contact: str = ""
    why_now: str = ""
    why_person: str = ""
    potential_problem: str = ""
    recommended_angle: str = ""
    evidence_ids: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


class ScoringInputs(StrictModel):
    """The normalized, VERIFIED attributes the score was computed from. Persisting them lets the app re-score
    after an ICP edit as a pure function of stored inputs (no re-research)."""

    industry: str | None = None
    country: str | None = None
    employee_count: int | None = None
    keywords_found: list[str] = Field(default_factory=list)
    person_title: str | None = None


class ResearchResult(StrictModel):
    schema_version: str = SCHEMA_VERSION
    scoring_version: str = "1"
    company: CompanyProfile
    people: list[Person] = Field(default_factory=list)
    signals: list[Signal] = Field(default_factory=list)
    evidence: list[Evidence] = Field(default_factory=list)
    icp: IcpResult
    intent: IntentResult
    scoring_inputs: ScoringInputs = Field(default_factory=ScoringInputs)
    qualified: bool = False
    why_fit: list[WhyFitItem] = Field(default_factory=list)
    outreach: Outreach = Field(default_factory=Outreach)
    unknowns: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
