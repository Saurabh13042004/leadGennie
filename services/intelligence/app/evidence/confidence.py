from __future__ import annotations

ENTAILMENT_FACTOR = {"yes": 1.0, "partial": 0.9, "no": 0.0}
CORROBORATION_STEP = 0.05
CORROBORATION_CAP = 0.15


def corroboration_bonus(independent_sources: int) -> float:
    return min(CORROBORATION_CAP, CORROBORATION_STEP * max(0, independent_sources - 1))


def confidence(tier_weight: float, entailment: str, recency: float, independent_sources: int) -> float:
    value = (
        tier_weight * ENTAILMENT_FACTOR[entailment] * recency * (1 + corroboration_bonus(independent_sources))
    )
    return round(max(0.0, min(1.0, value)), 3)
