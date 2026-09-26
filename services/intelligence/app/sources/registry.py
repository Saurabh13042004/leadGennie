from __future__ import annotations

from app.config import Settings
from app.sources.chained import ChainedSearch
from app.sources.gdelt import GdeltNews
from app.sources.search import BraveSearch, NullSearch, SearchProvider
from app.sources.tavily import TavilySearch


def build_search(settings: Settings) -> SearchProvider:
    """The configured search stack. Unset ⇒ `NullSearch` (connectors skip with a visible warning)."""
    primary: SearchProvider = NullSearch()
    if settings.search_provider == "tavily" and settings.tavily_api_key:
        primary = TavilySearch(settings)
    elif settings.search_provider == "brave" and settings.brave_api_key:
        primary = BraveSearch(settings)
    if settings.news_fallback == "gdelt":
        return ChainedSearch(primary, GdeltNews(settings))
    return primary


def describe_search(settings: Settings) -> str:
    """One line for /readyz: what search/news the engine will actually have."""
    key = {"tavily": settings.tavily_api_key, "brave": settings.brave_api_key}.get(
        settings.search_provider, ""
    )
    web = f"{settings.search_provider} (web+news)" if key else None
    if settings.search_provider != "none" and not key:
        return f"SEARCH_PROVIDER={settings.search_provider} but its API key is not set"
    if web and settings.news_fallback == "gdelt":
        return f"ok ({web}; news fallback: gdelt)"
    if web:
        return "ok"
    if settings.news_fallback == "gdelt":
        return "news only (gdelt, no web search)"
    return "no search provider (website+jobs only)"
