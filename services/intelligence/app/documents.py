"""Neutral internal model for captured web documents, shared by sources, extraction, evidence and store.

Kept at the package root so that `agents`/`evidence` can use it without importing `sources`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app import clock
from app.contracts.common import SourceType


class RawDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str
    final_url: str
    title: str | None = None
    fetched_at: datetime = Field(default_factory=clock.now)
    status_code: int = 200
    content_type: str = "text/html"
    text: str  # cleaned main text
    html_hash: str  # sha256 of the raw body
    published_at: datetime | None = None  # only when the page itself states it
    source_type: SourceType = SourceType.WEBSITE
    collector: str = "website"
    links: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    injection_flagged: bool = False


class DocumentSet:
    """The documents captured during one run. The Evidence Validator accepts a source URL only if it
    is in this set (URLs the model invented can never verify)."""

    def __init__(self) -> None:
        self._by_url: dict[str, RawDocument] = {}

    def add(self, doc: RawDocument) -> None:
        self._by_url.setdefault(doc.url, doc)
        self._by_url.setdefault(doc.final_url, doc)

    def get(self, url: str) -> RawDocument | None:
        return self._by_url.get(url)

    def __contains__(self, url: str) -> bool:
        return url in self._by_url

    def urls(self) -> set[str]:
        return set(self._by_url)

    def documents(self) -> list[RawDocument]:
        seen: dict[str, RawDocument] = {}
        for d in self._by_url.values():
            seen.setdefault(d.url, d)
        return list(seen.values())

    def __len__(self) -> int:
        return len(self.documents())
