"""Deterministic intent scoring from VERIFIED signals only."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime

from app import clock
from app.contracts.common import SignalType
from app.contracts.result import IntentBreakdownItem, IntentResult

TYPE_WEIGHT: dict[SignalType, float] = {
    SignalType.FUNDING: 25,
    SignalType.HIRING: 20,
    SignalType.JOB_POSTING: 20,
    SignalType.EXPANSION: 20,
    SignalType.LEADERSHIP_CHANGE: 15,
    SignalType.PRODUCT_LAUNCH: 10,
    SignalType.TECH_CHANGE: 10,
    SignalType.NEWS: 5,
}
HALF_LIFE_DAYS: dict[SignalType, float] = {
    SignalType.FUNDING: 90,
    SignalType.LEADERSHIP_CHANGE: 60,
    SignalType.NEWS: 30,
    SignalType.JOB_POSTING: 30,
    SignalType.HIRING: 45,
    SignalType.EXPANSION: 45,
    SignalType.PRODUCT_LAUNCH: 45,
    SignalType.TECH_CHANGE: 45,
}
EXPIRES_DAYS = 180
UNDATED_AGE_DAYS = 120  # an undated source is treated as old, never as fresh
DIMINISHING = (1.0, 0.5, 0.25)  # 2nd signal of the same type counts half, 3rd+ a quarter


@dataclass(frozen=True)
class SignalInput:
    type: SignalType
    confidence: float
    detected_at: date | datetime | None
    verified: bool
    id: str | None = None


def _age_days(detected: date | datetime | None, as_of: date) -> float:
    if detected is None:
        return float(UNDATED_AGE_DAYS)
    d = (
        detected.astimezone(UTC).date()
        if isinstance(detected, datetime) and detected.tzinfo
        else (detected.date() if isinstance(detected, datetime) else detected)
    )
    return float(max(0, (as_of - d).days))


def score_intent(signals: list[SignalInput], as_of: date | None = None) -> IntentResult:
    as_of = as_of or clock.now().date()
    per_type: dict[SignalType, list[IntentBreakdownItem]] = {}
    for s in signals:
        if not s.verified:
            continue  # unverified signals have zero influence
        age = _age_days(s.detected_at, as_of)
        if age > EXPIRES_DAYS:
            continue
        recency = 0.5 ** (age / HALF_LIFE_DAYS[s.type])
        weight = TYPE_WEIGHT[s.type]
        raw = weight * s.confidence * recency
        per_type.setdefault(s.type, []).append(
            IntentBreakdownItem(
                signal_id=s.id,
                signal_type=s.type,
                weight=weight,
                confidence=round(s.confidence, 3),
                recency_factor=round(recency, 3),
                points=raw,
            )
        )
    breakdown: list[IntentBreakdownItem] = []
    total = 0.0
    for items in per_type.values():
        items.sort(key=lambda i: (-i.points, i.signal_id or ""))
        for rank, item in enumerate(items):
            factor = DIMINISHING[min(rank, len(DIMINISHING) - 1)]
            pts = item.points * factor
            total += pts
            breakdown.append(item.model_copy(update={"points": round(pts, 2)}))
    breakdown.sort(key=lambda i: (-i.points, i.signal_id or ""))
    return IntentResult(score=max(0, min(100, round(total))), breakdown=breakdown)
