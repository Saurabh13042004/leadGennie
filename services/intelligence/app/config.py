from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from the environment (never logged). See .env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore", populate_by_name=True)

    # service auth
    intelligence_service_token: str = ""
    intelligence_signing_secret: str = ""
    intelligence_signing_secret_previous: str = ""
    auth_max_skew_seconds: int = 300

    # storage: unset => in-memory (dev/tests only)
    intel_database_url: str = ""

    # llm
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_model_entailment: str = ""

    # search / news (D-03)
    search_provider: Literal["none", "brave", "tavily"] = "none"
    brave_api_key: str = ""
    tavily_api_key: str = ""
    # Keyless news fallback (GDELT): used when the primary's news fails/has none, or ALONE when no primary is set.
    # Off by default so a deployment never calls a third party it did not opt into.
    news_fallback: Literal["none", "gdelt"] = "none"
    gdelt_language: str = "english"  # "" = any language

    # fetching
    fetch_user_agent: str = "LeadGennieBot/1.0 (+https://leadgennie.com/bot)"
    fetch_max_bytes: int = 2_000_000
    fetch_timeout_seconds: float = 15.0
    fetch_connect_timeout_seconds: float = 5.0
    fetch_host_rps: float = 1.0
    fetch_max_redirects: int = 5
    # tests only: allow fetching loopback/private addresses (never enable in a deployment)
    fetch_allow_private_network: bool = False

    # behavior
    verify_threshold: float = Field(default=0.70, ge=0, le=1)
    max_concurrent_runs: int = Field(default=4, ge=1)
    run_retention_days: int = 30
    log_level: str = "INFO"
    engine_fake_mode: bool = False

    @property
    def signing_secrets(self) -> list[str]:
        return [s for s in (self.intelligence_signing_secret, self.intelligence_signing_secret_previous) if s]

    @property
    def entailment_model(self) -> str:
        return self.openai_model_entailment or self.openai_model


@lru_cache
def get_settings() -> Settings:
    return Settings()
