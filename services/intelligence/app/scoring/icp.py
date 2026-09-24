"""Deterministic ICP scoring. Pure functions — same input, same output; no network, no LLM."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.contracts.icp import Icp
from app.contracts.result import IcpBreakdownItem, IcpResult
from app.scoring import taxonomy

SCORING_VERSION = "1"
EXCLUDED_SCORE_CAP = 10


@dataclass(frozen=True)
class Attributes:
    """Normalized, *verified* attributes. `None` means unknown — never "no"."""

    industry: str | None = None
    country: str | None = None
    employee_count: int | None = None
    seniority: str | None = None
    function: str | None = None
    domain: str | None = None
    title_text: str | None = None
    has_person: bool = False
    keywords_found: frozenset[str] = frozenset()
    evidence: dict[str, list[str]] = field(default_factory=dict)


@dataclass
class _Criterion:
    name: str
    weight: float
    status: str
    factor: float
    value_found: str | None
    attribute: str


def _evidence(attrs: Attributes, attribute: str) -> list[str]:
    return list(attrs.evidence.get(attribute, []))


def _industry(icp: Icp, attrs: Attributes) -> _Criterion | None:
    if not icp.industries:
        return None
    weight = max(w.weight for w in icp.industries)
    if weight <= 0:
        return None
    if attrs.industry is None:
        return _Criterion("industry", weight, "unknown", 0.0, None, "industry")
    best = 0.0
    status = "not_met"
    for entry in icp.industries:
        target = taxonomy.normalize_industry(entry.value) or entry.value.strip().lower()
        if attrs.industry == target:
            f = entry.weight / weight
            if f > best:
                best, status = f, "met"
        elif frozenset({attrs.industry, target}) in taxonomy.ADJACENT_INDUSTRIES and best < 0.5 * (
            entry.weight / weight
        ):
            best, status = 0.5 * (entry.weight / weight), "partial"
    return _Criterion("industry", weight, status, best, attrs.industry, "industry")


def _employees(icp: Icp, attrs: Attributes) -> _Criterion | None:
    rng = icp.employee_range
    if rng is None or rng.weight <= 0 or (rng.min is None and rng.max is None):
        return None
    if attrs.employee_count is None:
        return _Criterion("employee_range", rng.weight, "unknown", 0.0, None, "employee_count")
    n = attrs.employee_count
    lo, hi = rng.min, rng.max
    if (lo is None or n >= lo) and (hi is None or n <= hi):
        status, factor = "met", 1.0
    elif (lo is not None and n < lo and n >= lo * 0.75) or (hi is not None and n > hi and n <= hi * 1.25):
        status, factor = "partial", 0.5
    else:
        status, factor = "not_met", 0.0
    return _Criterion("employee_range", rng.weight, status, factor, str(n), "employee_count")


def _geography(icp: Icp, attrs: Attributes) -> _Criterion | None:
    if not icp.geographies:
        return None
    weight = max(g.weight for g in icp.geographies)
    if weight <= 0:
        return None
    if attrs.country is None:
        return _Criterion("geography", weight, "unknown", 0.0, None, "country")
    best = 0.0
    for g in icp.geographies:
        if taxonomy.country_matches(attrs.country, g.value):
            best = max(best, g.weight / weight)
    return _Criterion("geography", weight, "met" if best > 0 else "not_met", best, attrs.country, "country")


def _title(icp: Icp, attrs: Attributes) -> _Criterion | None:
    if not icp.titles:
        return None
    weight = max(t.weight for t in icp.titles)
    if weight <= 0:
        return None
    if not attrs.has_person or (attrs.seniority is None and attrs.function is None):
        return _Criterion("title", weight, "unknown", 0.0, attrs.title_text, "title")
    best, status = 0.0, "not_met"
    title = (attrs.title_text or "").lower()
    for t in icp.titles:
        checks = []
        if t.seniority:
            checks.append(attrs.seniority in t.seniority)
        if t.function:
            checks.append(attrs.function in t.function)
        keyword_hit = any(
            re.search(rf"(?<![a-z0-9]){re.escape(k.strip().lower())}(?![a-z0-9])", title)
            for k in t.keywords
            if k.strip()
        )
        if not checks and not t.keywords:
            continue
        f = t.weight / weight
        if (keyword_hit or (checks and all(checks))) and f > best:
            best, status = f, "met"
        elif checks and any(checks) and best < 0.5 * f:
            best, status = 0.5 * f, "partial"
    return _Criterion("title", weight, status, best, attrs.title_text, "title")


def _keywords(icp: Icp, attrs: Attributes) -> list[_Criterion]:
    out: list[_Criterion] = []
    for kw in icp.keyword_signals:
        if kw.weight <= 0:
            continue
        found = kw.keyword.strip().lower() in attrs.keywords_found
        out.append(
            _Criterion(
                f"keyword:{kw.keyword.strip().lower()}",
                kw.weight,
                "met" if found else "not_met",
                1.0 if found else 0.0,
                kw.keyword if found else None,
                "keywords",
            )
        )
    return out


def _exclusion_reasons(icp: Icp, attrs: Attributes) -> list[str]:
    reasons: list[str] = []
    excl = icp.exclusions
    if attrs.industry and any(
        (taxonomy.normalize_industry(v) or v.strip().lower()) == attrs.industry for v in excl.industries
    ):
        reasons.append(f"excluded industry: {attrs.industry}")
    if attrs.domain and any(
        attrs.domain == d.strip().lower() or attrs.domain.endswith("." + d.strip().lower())
        for d in excl.domains
    ):
        reasons.append(f"excluded domain: {attrs.domain}")
    if attrs.title_text and any(
        t.strip().lower() in attrs.title_text.lower() for t in excl.titles if t.strip()
    ):
        reasons.append(f"excluded title: {attrs.title_text}")
    return reasons


def score_icp(icp: Icp, attrs: Attributes) -> IcpResult:
    criteria: list[_Criterion] = [
        c
        for c in (_industry(icp, attrs), _employees(icp, attrs), _geography(icp, attrs), _title(icp, attrs))
        if c
    ]
    criteria.extend(_keywords(icp, attrs))

    reasons = _exclusion_reasons(icp, attrs)
    total_weight = sum(c.weight for c in criteria)
    breakdown: list[IcpBreakdownItem] = []
    score = 0.0
    unknown_weight = 0.0
    for c in criteria:
        norm_weight = (c.weight / total_weight * 100.0) if total_weight else 0.0
        points = norm_weight * c.factor
        score += points
        if c.status == "unknown":
            unknown_weight += norm_weight
        breakdown.append(
            IcpBreakdownItem(
                criterion=c.name,
                status=c.status,
                weight=round(norm_weight, 2),
                points=round(points, 2),
                value_found=c.value_found,
                evidence_ids=_evidence(attrs, c.attribute) if c.status in ("met", "partial") else [],
            )
        )
    for reason in reasons:
        breakdown.append(
            IcpBreakdownItem(criterion="exclusion", status="not_met", weight=0, points=0, value_found=reason)
        )

    final = round(score)
    if reasons:
        final = min(final, EXCLUDED_SCORE_CAP)
    confidence = 1.0 - 0.6 * (unknown_weight / 100.0) if total_weight else 0.0
    return IcpResult(
        score=max(0, min(100, final)),
        confidence=round(max(0.0, min(1.0, confidence)), 3),
        breakdown=breakdown,
    )
