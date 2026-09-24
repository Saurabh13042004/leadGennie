from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol

from app.documents import RawDocument
from app.pipeline.context import PipelineContext
from app.urls import registrable_domain, same_site

__all__ = [
    "CollectQuery",
    "Collector",
    "registrable_domain",
    "same_site",
]  # helpers re-exported for connectors


@dataclass(frozen=True)
class CollectQuery:
    company_name: str
    domain: str | None
    lead_name: str | None = None
    offer_keywords: tuple[str, ...] = ()
    freshness_seconds: float = 0.0
    extra: dict[str, str] = field(default_factory=dict)


class Collector(Protocol):
    """Collectors GET information. They never decide whether something is a claim or a signal."""

    name: str

    async def collect(self, ctx: PipelineContext, query: CollectQuery) -> list[RawDocument]: ...
