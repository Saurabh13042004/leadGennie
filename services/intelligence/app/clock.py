"""The one place logic asks "what time is it?" — so recency windows and score decay are deterministic in tests."""

from __future__ import annotations

from datetime import UTC, datetime

_frozen: datetime | None = None


def now() -> datetime:
    return _frozen or datetime.now(UTC)


def freeze(moment: datetime | None) -> None:
    """Tests only: pin (or, with None, release) the clock."""
    global _frozen
    _frozen = moment
