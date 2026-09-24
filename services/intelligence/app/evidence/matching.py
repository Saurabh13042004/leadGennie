"""Deterministic text matching used by extraction (span verification) and the Evidence Validator.
Pure functions; no network, no LLM."""

from __future__ import annotations

import re
import unicodedata
from difflib import SequenceMatcher

_ZERO_WIDTH = dict.fromkeys(map(ord, "​‌‍⁠﻿"), None)
_QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "−": "-"})
_WS = re.compile(r"\s+")

FUZZY_THRESHOLD = 0.92
MIN_FUZZY_TOKENS = 6


def normalize(text: str) -> str:
    """NFKC + casefold + smart-quote/dash folding + whitespace collapse."""
    t = unicodedata.normalize("NFKC", text).translate(_ZERO_WIDTH).translate(_QUOTES).casefold()
    return _WS.sub(" ", t).strip()


def find_span(snippet: str, doc_text: str) -> tuple[bool, str]:
    """Is `snippet` present in `doc_text`? -> (found, method) with method in {'exact', 'fuzzy', 'none'}.

    Exact = normalized substring. Fuzzy is allowed only for long-enough snippets (markup noise / stray
    punctuation), never for short ones — a short snippet must match exactly."""
    s, d = normalize(snippet), normalize(doc_text)
    if not s:
        return False, "none"
    if s in d:
        return True, "exact"
    s_tokens, d_tokens = s.split(), d.split()
    if len(s_tokens) < MIN_FUZZY_TOKENS or len(d_tokens) < len(s_tokens) - 2:
        return False, "none"
    n = len(s_tokens)
    first = s_tokens[0]
    for i, tok in enumerate(d_tokens):
        if tok != first and SequenceMatcher(None, tok, first).ratio() < 0.8:
            continue
        for width in (n, n - 1, n + 1):
            window = " ".join(d_tokens[i : i + width])
            if SequenceMatcher(None, s, window).ratio() >= FUZZY_THRESHOLD:
                return True, "fuzzy"
    return False, "none"


def context_window(snippet: str, doc_text: str, radius: int = 300) -> str:
    """The normalized text around where `snippet` occurs (or the whole doc head if not located)."""
    s, d = normalize(snippet), normalize(doc_text)
    idx = d.find(s)
    if idx < 0:
        return d[: radius * 2]
    return d[max(0, idx - radius) : idx + len(s) + radius]


_LEGAL_SUFFIX = re.compile(
    r"\b(inc|incorporated|ltd|limited|llc|llp|pvt|private|corp|corporation|co|company|gmbh|ag|plc|pte|sa|bv)\b\.?",
    re.I,
)


def company_aliases(name: str, domain: str | None) -> set[str]:
    """Normalized names a page might use for the company (with/without legal suffix, domain label)."""
    base = normalize(name)
    stripped = normalize(_LEGAL_SUFFIX.sub("", name)).strip(" ,.")
    aliases = {a for a in (base, stripped) if len(a) >= 2}
    if domain:
        label = domain.lower().removeprefix("www.").split(".")[0]
        if len(label) >= 3:
            aliases.add(label)
    return aliases


_NUM_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
    "thirteen": 13,
    "fourteen": 14,
    "fifteen": 15,
    "twenty": 20,
    "thirty": 30,
    "forty": 40,
    "fifty": 50,
    "hundred": 100,
}
_SCALE = {"k": 1e3, "thousand": 1e3, "m": 1e6, "mm": 1e6, "million": 1e6, "b": 1e9, "bn": 1e9, "billion": 1e9}
_NUM = re.compile(
    r"(?<![\w.])(\$|€|£|₹)?\s?(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s?(k|thousand|mm|m|million|bn|b|billion)?(?![\w])",
    re.I,
)
_WORD_NUM = re.compile(r"\b(" + "|".join(_NUM_WORDS) + r")\b", re.I)


def extract_numbers(text: str) -> set[float]:
    """Numeric values mentioned in text, with scale words folded in ('$12 million' == '12M' == 12_000_000)."""
    t = normalize(text)
    values: set[float] = set()
    for m in _NUM.finditer(t):
        val = float(m.group(2).replace(",", ""))
        scale = m.group(3)
        if scale:
            val *= _SCALE[scale.lower()]
        values.add(val)
    for m in _WORD_NUM.finditer(t):
        values.add(float(_NUM_WORDS[m.group(1).lower()]))
    return values


_ALIASES = {
    "us": "united states",
    "u.s.": "united states",
    "usa": "united states",
    "uk": "united kingdom",
    "u.k.": "united kingdom",
    "uae": "united arab emirates",
    "eu": "european union",
}
_STOP_ENTITIES = frozenset(
    {
        "the",
        "a",
        "an",
        "its",
        "their",
        "our",
        "we",
        "it",
        "this",
        "that",
        "and",
        "or",
        "in",
        "on",
        "at",
        "for",
        "to",
        "of",
        "with",
        "by",
        "from",
        "as",
        "is",
        "are",
        "was",
        "were",
        "has",
        "have",
        "had",
        "company",
        "team",
        "new",
        "today",
        "also",
        "which",
        "who",
        "led",
        "after",
        "before",
        "more",
        "about",
        "over",
        "under",
        "into",
    }
)
_ENTITY = re.compile(r"\b([A-Z][\w&'.-]*(?:\s+[A-Z][\w&'.-]*)*)")
_MONTHS = (
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
)


def extract_entities(claim: str) -> set[str]:
    """Proper-noun-ish tokens in the claim (skipping the sentence-initial word), normalized."""
    ents: set[str] = set()
    tokens = list(_ENTITY.finditer(claim))
    for m in tokens:
        text = m.group(1)
        if m.start() == 0:  # sentence-initial capital carries no signal
            parts = text.split()
            text = " ".join(parts[1:]) if len(parts) > 1 else ""
        for part in re.split(r"\s+", text):
            p = part.strip(".,;:()'\"")
            if len(p) >= 2 and p.casefold() not in _STOP_ENTITIES and normalize(p) not in _MONTHS:
                ents.add(_ALIASES.get(normalize(p), normalize(p)))
    return ents


def entity_supported(entity: str, haystack_norm: str, aliases: set[str]) -> bool:
    if entity in aliases or any(entity in a.split() for a in aliases):
        return True
    if entity in haystack_norm:
        return True
    # acronym / short-form variants (US <-> united states, u.s.)
    for short, long in _ALIASES.items():
        if entity == long and re.search(rf"(?<!\w){re.escape(short)}(?!\w)", haystack_norm):
            return True
        if entity == short and long in haystack_norm:
            return True
    return False


def claim_consistency(claim: str, snippet_norm_joined: str, aliases: set[str]) -> tuple[bool, list[str]]:
    """Every number and named entity in the claim must be supported by the snippet(s) (or be the company).
    Returns (ok, problems). This is a deliberately strict, *deterministic* gate that runs before the LLM."""
    problems: list[str] = []
    snippet_nums = extract_numbers(snippet_norm_joined)
    for n in sorted(extract_numbers(claim)):
        if not any(abs(n - m) < 1e-9 for m in snippet_nums):
            problems.append(f"number {n:g} not in source")
    for ent in sorted(extract_entities(claim)):
        if not entity_supported(ent, snippet_norm_joined, aliases):
            problems.append(f"entity '{ent}' not in source")
    return (not problems), problems
