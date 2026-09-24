"""Heuristic prompt-injection scanner for fetched content. Content is always *data*; this only flags it
(the document is down-weighted and the trace records it) — it is never obeyed, and never silently dropped."""

from __future__ import annotations

import re

_PATTERNS: tuple[re.Pattern[str], ...] = tuple(
    re.compile(p, re.IGNORECASE)
    for p in (
        r"ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?|messages?)",
        r"disregard (all |any )?(the )?(previous|prior|above|system)",
        r"forget (everything|all|your) (you|instructions|above)",
        r"you are now (a|an|the) ",
        r"(new|updated) (system )?instructions?:",
        r"\bsystem prompt\b",
        r"reveal (your|the) (system )?(prompt|instructions|api key|secrets?)",
        r"do not (tell|inform) the user",
        r"as an ai (language )?model,? you (must|should|will)",
        r"<\s*/?\s*(system|assistant)\s*>",
        r"mark (this|the) (claim|source|evidence) as verified",
        r"set (verified|confidence) (to )?(true|1)",
    )
)


def scan_for_injection(text: str) -> list[str]:
    """Return the matched pattern sources (empty when the text looks clean)."""
    return [p.pattern for p in _PATTERNS if p.search(text)]


def looks_injected(text: str) -> bool:
    return bool(scan_for_injection(text))
