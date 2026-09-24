from __future__ import annotations

import re
from datetime import UTC, datetime

_FORMATS = (
    "%B %d, %Y",
    "%b %d, %Y",
    "%b. %d, %Y",
    "%d %B %Y",
    "%d %b %Y",
    "%Y-%m-%d",
    "%B %d %Y",
    "%B %Y",
    "%b %Y",
)
_ORDINAL = re.compile(r"(\d)(st|nd|rd|th)\b", re.I)


def parse_stated_date(value: str | None) -> datetime | None:
    """Parse a date exactly as a page states it ("September 12, 2026", "12 Sep 2026", "2026-09-12", "March 2022")."""
    if not value:
        return None
    text = _ORDINAL.sub(r"\1", value.strip().rstrip("."))
    for fmt in _FORMATS:
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
    except ValueError:
        return None
