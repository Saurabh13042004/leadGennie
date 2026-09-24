from __future__ import annotations

from typing import Literal

from pydantic import Field

from app.contracts.common import SignalType, StrictModel
from app.contracts.result import Verification


class ClaimCheck(StrictModel):
    name: str
    passed: bool
    hard: bool
    note: str = ""


class ClaimInput(StrictModel):
    id: str
    claim: str = Field(min_length=3, max_length=1000)
    source_url: str
    snippet: str = Field(min_length=3, max_length=2000)
    company_name: str
    company_domain: str | None = None
    signal_type: SignalType | None = None
    source_date: str | None = None


class ValidateRequest(StrictModel):
    claims: list[ClaimInput] = Field(min_length=1, max_length=25)
    refetch: bool = True


class ClaimVerdict(StrictModel):
    id: str
    verdict: Verification
    checks: list[ClaimCheck] = Field(default_factory=list)
    narrowed_claim: str | None = None


class ValidateData(StrictModel):
    verdicts: list[ClaimVerdict]


class ValidateResponse(StrictModel):
    ok: Literal[True] = True
    data: ValidateData
