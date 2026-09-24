from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from app.contracts.common import SignalType

ClaimType = Literal["profile_field", "signal", "person", "job", "outreach"]


@dataclass(frozen=True)
class EvidenceRef:
    source_url: str
    snippet: str


@dataclass
class Claim:
    id: str
    text: str
    type: ClaimType
    refs: list[EvidenceRef]
    company_name: str
    company_domain: str | None = None
    company_location: str | None = None
    signal_type: SignalType | None = None
    source_date: datetime | None = None  # a date stated by the source, if the caller extracted one


@dataclass
class CheckResult:
    name: str
    passed: bool
    hard: bool
    note: str = ""


@dataclass
class RefResult:
    ref: EvidenceRef
    fetched: bool
    passed: bool  # all hard ref-level checks passed
    checks: list[CheckResult] = field(default_factory=list)
    tier: str = "unknown"
    tier_weight: float = 0.0
    doc_url: str | None = None


@dataclass
class ClaimVerdict:
    claim: Claim
    verified: bool
    confidence: float
    checks: list[CheckResult] = field(default_factory=list)
    refs: list[RefResult] = field(default_factory=list)
    narrowed_claim: str | None = None
    notes: list[str] = field(default_factory=list)
    methods: list[str] = field(default_factory=list)

    @property
    def passing_refs(self) -> list[RefResult]:
        return [r for r in self.refs if r.passed]

    @property
    def fetched_refs(self) -> list[RefResult]:
        return [r for r in self.refs if r.fetched]

    @property
    def text(self) -> str:
        return self.narrowed_claim or self.claim.text
