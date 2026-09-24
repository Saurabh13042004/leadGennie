from __future__ import annotations

from pydantic import Field, model_validator

from app.contracts.common import StrictModel


class WeightedValue(StrictModel):
    value: str
    weight: float = Field(default=10, ge=0)


class EmployeeRange(StrictModel):
    min: int | None = Field(default=None, ge=0)
    max: int | None = Field(default=None, ge=0)
    weight: float = Field(default=20, ge=0)

    @model_validator(mode="after")
    def _order(self) -> EmployeeRange:
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("employee_range.min must be <= max")
        return self


class TitleCriterion(StrictModel):
    """A target role. Met when the title matches any `keywords` (whole-word, case-insensitive: "cto", "vp of
    engineering") OR satisfies every given `seniority`/`function` constraint."""

    keywords: list[str] = Field(default_factory=list)
    seniority: list[str] = Field(default_factory=list)
    function: list[str] = Field(default_factory=list)
    weight: float = Field(default=25, ge=0)


class KeywordSignal(StrictModel):
    keyword: str
    weight: float = Field(default=10, ge=0)


class Exclusions(StrictModel):
    industries: list[str] = Field(default_factory=list)
    domains: list[str] = Field(default_factory=list)
    titles: list[str] = Field(default_factory=list)


class Icp(StrictModel):
    """Workspace ICP definition (docs/intelligence-engine/scoring.md). Sent as data with every request."""

    industries: list[WeightedValue] = Field(default_factory=list)
    employee_range: EmployeeRange | None = None
    geographies: list[WeightedValue] = Field(default_factory=list)
    titles: list[TitleCriterion] = Field(default_factory=list)
    keyword_signals: list[KeywordSignal] = Field(default_factory=list)
    exclusions: Exclusions = Field(default_factory=Exclusions)
    min_score_to_qualify: int = Field(default=70, ge=0, le=100)
