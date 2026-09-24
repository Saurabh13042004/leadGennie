from __future__ import annotations

from datetime import UTC, datetime

from app import clock
from app.contracts.common import SignalType

# Days a source stays "recent enough" for each kind of time-sensitive claim.
WINDOW_DAYS: dict[SignalType, int] = {
    SignalType.FUNDING: 548,
    SignalType.EXPANSION: 365,
    SignalType.PRODUCT_LAUNCH: 365,
    SignalType.LEADERSHIP_CHANGE: 365,
    SignalType.TECH_CHANGE: 365,
    SignalType.NEWS: 183,
    SignalType.HIRING: 60,
    SignalType.JOB_POSTING: 60,
}
UNDATED_FACTOR_FIRST_PARTY = 0.75
UNDATED_FACTOR_OTHER = 0.60


def recency_factor(
    signal_type: SignalType | None,
    source_date: datetime | None,
    first_party: bool,
    now: datetime | None = None,
) -> tuple[float, str | None, bool]:
    """-> (factor, note, expired). Beyond 2x the window a claim is expired: it can't be presented as *current*."""
    if signal_type is None:
        return 1.0, None, False
    if source_date is None:
        return (UNDATED_FACTOR_FIRST_PARTY if first_party else UNDATED_FACTOR_OTHER), "undated_source", False
    now = now or clock.now()
    sd = source_date if source_date.tzinfo else source_date.replace(tzinfo=UTC)
    age = max(0.0, (now - sd).total_seconds() / 86400)
    window = WINDOW_DAYS[signal_type]
    if age <= window:
        return 1.0, None, False
    if age > 2 * window:
        return 0.0, f"stale: source is {int(age)} days old (window {window})", True
    factor = 1.0 - 0.5 * ((age - window) / window)
    return round(factor, 3), f"aging: source is {int(age)} days old (window {window})", False
