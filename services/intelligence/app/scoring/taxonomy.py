"""Versioned taxonomies used to normalize free text into comparable values. Pure data + rule-based lookups."""

from __future__ import annotations

import re

TAXONOMY_VERSION = "1"

# Ordered: more specific industries first so "fintech software" resolves to fintech, not b2b_saas.
INDUSTRY_SYNONYMS: dict[str, tuple[str, ...]] = {
    "fintech": (
        "fintech",
        "financial technology",
        "payments",
        "insurtech",
        "neobank",
        "lending platform",
        "banking software",
    ),
    "healthtech": (
        "healthtech",
        "health tech",
        "digital health",
        "healthcare software",
        "medtech",
        "telehealth",
    ),
    "edtech": ("edtech", "education technology", "e-learning", "online learning"),
    "cybersecurity": ("cybersecurity", "cyber security", "security software", "infosec", "identity security"),
    "ai_ml": (
        "artificial intelligence",
        "machine learning",
        "generative ai",
        "ai platform",
        "llm",
        "computer vision",
    ),
    "martech": (
        "martech",
        "marketing technology",
        "adtech",
        "advertising technology",
        "sales enablement",
        "sales tech",
    ),
    "hrtech": (
        "hr tech",
        "hrtech",
        "recruiting software",
        "talent platform",
        "hr software",
        "payroll software",
    ),
    "devtools": ("developer tools", "devtools", "developer platform", "api platform", "devops"),
    "ecommerce": (
        "e-commerce",
        "ecommerce",
        "online retail",
        "d2c",
        "direct to consumer",
        "online marketplace",
    ),
    "logistics": ("logistics", "supply chain", "freight", "shipping", "fleet"),
    "real_estate": ("real estate", "proptech", "property management"),
    "energy": ("energy", "cleantech", "renewable", "solar"),
    "telecom": ("telecom", "telecommunications", "wireless carrier"),
    "manufacturing": ("manufacturing", "industrial", "hardware"),
    "media": ("media", "publishing", "entertainment", "gaming"),
    "agency": ("marketing agency", "digital agency", "creative agency", "advertising agency", "agency"),
    "consulting": ("consulting", "professional services", "it services", "staffing", "outsourcing"),
    "b2b_saas": (
        "b2b saas",
        "saas",
        "software as a service",
        "b2b software",
        "enterprise software",
        "cloud software",
        "software",
    ),
}
INDUSTRY_KEYS: frozenset[str] = frozenset({*INDUSTRY_SYNONYMS, "other"})

_ADJACENT_PAIRS = {
    ("b2b_saas", "devtools"),
    ("b2b_saas", "ai_ml"),
    ("b2b_saas", "martech"),
    ("b2b_saas", "hrtech"),
    ("b2b_saas", "cybersecurity"),
    ("b2b_saas", "fintech"),
    ("b2b_saas", "healthtech"),
    ("b2b_saas", "edtech"),
    ("ai_ml", "devtools"),
    ("consulting", "agency"),
    ("martech", "agency"),
    ("ecommerce", "logistics"),
}
ADJACENT_INDUSTRIES: frozenset[frozenset[str]] = frozenset(frozenset(p) for p in _ADJACENT_PAIRS)

SENIORITIES = ("founder", "cxo", "vp", "head", "director", "manager", "ic")
FUNCTIONS = (
    "sales",
    "marketing",
    "engineering",
    "product",
    "operations",
    "finance",
    "hr",
    "customer_success",
    "general",
    "other",
)

_SENIORITY_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("founder", re.compile(r"\b(co-?founder|founder|owner|proprietor)\b")),
    (
        "cxo",
        re.compile(
            r"\b(chief [a-z ]+ officer|ceo|cto|cfo|coo|cmo|cro|cpo|ciso|cio|president|managing director)\b"
        ),
    ),
    ("vp", re.compile(r"\b(vice president|vp|svp|evp|avp)\b")),
    ("head", re.compile(r"\bhead of\b|\bhead,")),
    ("director", re.compile(r"\bdirector\b")),
    ("manager", re.compile(r"\b(manager|lead|principal|supervisor)\b")),
)
_FUNCTION_RULES: tuple[tuple[str, re.Pattern[str]], ...] = (
    # Order matters: the most specific / least ambiguous functions come first
    # ("Customer Success Manager, Growth" is customer success; "Design Engineer (Brand)" is engineering;
    # "Sales Engineer" is sales; "Product Marketing Manager" is marketing, not product).
    (
        "customer_success",
        re.compile(
            r"\b(customer success|customer support|customer experience|support specialist|support engineer|client services)\b"
        ),
    ),
    (
        "sales",
        re.compile(
            r"\b(sales|revenue|business development|bdr|sdr|account executive|account manager|cro|partnerships?)\b"
        ),
    ),
    (
        "engineering",
        re.compile(
            r"\b(engineering|engineer|engineers|technology|technical|developer|devops|data scientist|data analyst|data|cto|software|security|ciso|infrastructure|sre)\b"
        ),
    ),
    (
        "marketing",
        re.compile(r"\b(marketing|growth|demand gen(?:eration)?|brand|content|communications|cmo)\b"),
    ),
    ("product", re.compile(r"\b(product|cpo|design|designer)\b")),
    ("finance", re.compile(r"\b(finance|financial|accounting|cfo|controller|deal desk)\b")),
    ("hr", re.compile(r"\b(people|human resources|hr|talent|recruit\w*)\b")),
    ("operations", re.compile(r"\b(operations|ops|coo|supply chain|logistics|implementation)\b")),
    ("general", re.compile(r"\b(ceo|founder|co-?founder|president|managing director|owner)\b")),
)

_COUNTRY_NAMES: dict[str, str] = {
    "india": "IN",
    "united states": "US",
    "usa": "US",
    "u.s.": "US",
    "united states of america": "US",
    "united kingdom": "GB",
    "uk": "GB",
    "england": "GB",
    "canada": "CA",
    "germany": "DE",
    "france": "FR",
    "netherlands": "NL",
    "spain": "ES",
    "italy": "IT",
    "ireland": "IE",
    "sweden": "SE",
    "norway": "NO",
    "denmark": "DK",
    "finland": "FI",
    "switzerland": "CH",
    "austria": "AT",
    "belgium": "BE",
    "poland": "PL",
    "portugal": "PT",
    "australia": "AU",
    "new zealand": "NZ",
    "singapore": "SG",
    "japan": "JP",
    "south korea": "KR",
    "china": "CN",
    "hong kong": "HK",
    "indonesia": "ID",
    "philippines": "PH",
    "vietnam": "VN",
    "thailand": "TH",
    "malaysia": "MY",
    "united arab emirates": "AE",
    "uae": "AE",
    "saudi arabia": "SA",
    "israel": "IL",
    "turkey": "TR",
    "egypt": "EG",
    "nigeria": "NG",
    "kenya": "KE",
    "south africa": "ZA",
    "brazil": "BR",
    "mexico": "MX",
    "argentina": "AR",
    "colombia": "CO",
    "chile": "CL",
}
_CITY_TO_COUNTRY: dict[str, str] = {
    "bengaluru": "IN",
    "bangalore": "IN",
    "mumbai": "IN",
    "delhi": "IN",
    "new delhi": "IN",
    "hyderabad": "IN",
    "pune": "IN",
    "chennai": "IN",
    "gurgaon": "IN",
    "gurugram": "IN",
    "noida": "IN",
    "kolkata": "IN",
    "san francisco": "US",
    "new york": "US",
    "austin": "US",
    "boston": "US",
    "seattle": "US",
    "los angeles": "US",
    "chicago": "US",
    "london": "GB",
    "manchester": "GB",
    "toronto": "CA",
    "vancouver": "CA",
    "berlin": "DE",
    "munich": "DE",
    "paris": "FR",
    "amsterdam": "NL",
    "dublin": "IE",
    "stockholm": "SE",
    "sydney": "AU",
    "melbourne": "AU",
    "tokyo": "JP",
    "dubai": "AE",
    "tel aviv": "IL",
    "sao paulo": "BR",
}
_ISO2 = frozenset(_COUNTRY_NAMES.values())

REGIONS: dict[str, frozenset[str]] = {
    "NA": frozenset({"US", "CA"}),
    "EU": frozenset({"DE", "FR", "NL", "ES", "IT", "IE", "SE", "DK", "FI", "AT", "BE", "PL", "PT"}),
    "EMEA": frozenset(
        {
            "GB",
            "DE",
            "FR",
            "NL",
            "ES",
            "IT",
            "IE",
            "SE",
            "NO",
            "DK",
            "FI",
            "CH",
            "AT",
            "BE",
            "PL",
            "PT",
            "AE",
            "SA",
            "IL",
            "TR",
            "EG",
            "NG",
            "KE",
            "ZA",
        }
    ),
    "APAC": frozenset({"IN", "SG", "JP", "KR", "CN", "HK", "ID", "PH", "VN", "TH", "MY", "AU", "NZ"}),
    "LATAM": frozenset({"BR", "MX", "AR", "CO", "CL"}),
    "DACH": frozenset({"DE", "AT", "CH"}),
}


def _slug(text: str) -> str:
    return re.sub(r"[\s\-/]+", "_", text.strip().lower())


def normalize_industry(text: str | None) -> str | None:
    """Rule-based industry → taxonomy key, or None when the text can't be mapped (callers may then use an LLM)."""
    if not text or not text.strip():
        return None
    slug = _slug(text)
    if slug in INDUSTRY_KEYS:
        return slug
    lowered = f" {text.strip().lower()} "
    for key, synonyms in INDUSTRY_SYNONYMS.items():
        for syn in synonyms:
            if re.search(rf"(?<![a-z]){re.escape(syn)}(?![a-z])", lowered):
                return key
    return None


def normalize_country(text: str | None) -> str | None:
    if not text or not text.strip():
        return None
    parts = [p.strip() for p in re.split(r"[,/|]", text) if p.strip()]
    for part in reversed(parts):
        upper = part.upper()
        if upper in _ISO2:
            return upper
        lower = part.lower()
        if lower in _COUNTRY_NAMES:
            return _COUNTRY_NAMES[lower]
        if lower in _CITY_TO_COUNTRY:
            return _CITY_TO_COUNTRY[lower]
    for part in parts:
        if part.lower() in _CITY_TO_COUNTRY:
            return _CITY_TO_COUNTRY[part.lower()]
    return None


def country_matches(country: str, target: str) -> bool:
    """Does `country` (ISO code) satisfy an ICP geography, which may be a region ("APAC"), an ISO code ("IN")
    or a plain name ("India", "Bengaluru")?"""
    upper = target.strip().upper()
    if upper in REGIONS:
        return country in REGIONS[upper]
    iso = upper if upper in _ISO2 else normalize_country(target)
    return iso is not None and country == iso


def normalize_title(title: str | None) -> tuple[str | None, str | None]:
    """title → (seniority, function). Either may be None when the text doesn't say."""
    if not title or not title.strip():
        return None, None
    lowered = title.lower()
    seniority = next((s for s, rx in _SENIORITY_RULES if rx.search(lowered)), "ic")
    function = next((f for f, rx in _FUNCTION_RULES if rx.search(lowered)), None)
    if function is None and seniority in ("founder", "cxo"):
        function = "general"
    return seniority, function


def find_countries(text: str) -> set[str]:
    """Countries named (directly or via well-known cities) in free text. Rule-based; whole-word matches only."""
    lowered = f" {text.lower()} "
    found: set[str] = set()
    for table in (_COUNTRY_NAMES, _CITY_TO_COUNTRY):
        for name, iso in table.items():
            if len(name) >= 3 and re.search(rf"(?<![a-z]){re.escape(name)}(?![a-z])", lowered):
                found.add(iso)
    return found


def normalize_function(text: str | None) -> str | None:
    """A department name or job title -> function key (None when nothing matches)."""
    if not text or not text.strip():
        return None
    lowered = text.lower()
    return next((f for f, rx in _FUNCTION_RULES if rx.search(lowered)), None)
