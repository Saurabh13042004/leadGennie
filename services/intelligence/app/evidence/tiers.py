"""Source tiers: how much a *kind of source* is worth as evidence."""

from __future__ import annotations

from collections.abc import Callable

from app.contracts.common import SourceType
from app.documents import RawDocument

TIER_WEIGHTS: dict[str, float] = {
    "first_party": 0.95,
    "reputable_news": 0.90,
    "ats": 0.90,
    "press_release": 0.85,
    "dated_news": 0.75,  # news article on an unlisted domain that states its publish date
    "news": 0.60,  # news-like page on an unlisted domain with no stated date (blog/aggregator-like)
    "aggregator": 0.60,
    "unknown": 0.40,
}

REPUTABLE_NEWS = frozenset(
    {
        "reuters.com",
        "bloomberg.com",
        "techcrunch.com",
        "forbes.com",
        "wsj.com",
        "ft.com",
        "cnbc.com",
        "axios.com",
        "businessinsider.com",
        "venturebeat.com",
        "theverge.com",
        "wired.com",
        "economictimes.indiatimes.com",
        "livemint.com",
        "business-standard.com",
        "yourstory.com",
        "inc42.com",
        "entrackr.com",
        "sifted.eu",
        "theinformation.com",
        "fortune.com",
        "nytimes.com",
        "bbc.com",
        "theguardian.com",
    }
)
PRESS_RELEASE_HOSTS = frozenset(
    {"prnewswire.com", "businesswire.com", "globenewswire.com", "prweb.com", "einpresswire.com"}
)
ATS_HOSTS = frozenset({"greenhouse.io", "lever.co", "ashbyhq.com", "workable.com", "smartrecruiters.com"})


def classify_source(
    doc: RawDocument, company_domain: str | None, registrable: Callable[[str], str]
) -> tuple[str, float]:
    """-> (tier name, weight). `registrable` is injected (DIP) so this module has no network/IO dependency."""
    host = registrable(doc.final_url)
    if company_domain and host == registrable(company_domain):
        return "first_party", TIER_WEIGHTS["first_party"]
    if doc.source_type == SourceType.JOBS_BOARD or host in ATS_HOSTS:
        return "ats", TIER_WEIGHTS["ats"]
    if host in PRESS_RELEASE_HOSTS or doc.source_type == SourceType.PRESS_RELEASE:
        return "press_release", TIER_WEIGHTS["press_release"]
    if host in REPUTABLE_NEWS:
        return "reputable_news", TIER_WEIGHTS["reputable_news"]
    if doc.source_type == SourceType.NEWS:
        return (
            ("dated_news", TIER_WEIGHTS["dated_news"]) if doc.published_at else ("news", TIER_WEIGHTS["news"])
        )
    return "unknown", TIER_WEIGHTS["unknown"]
