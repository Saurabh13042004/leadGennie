from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

FactField = Literal[
    "description",
    "industry",
    "employee_count",
    "location",
    "products",
    "market",
    "business_model",
    "founded",
    "customers",
]
EventKind = Literal[
    "funding", "expansion", "product_launch", "leadership_change", "tech_change", "news", "other"
]


class _Base(BaseModel):
    model_config = ConfigDict(extra="forbid")


# ---- what the LLM returns (one call may cover several documents; `doc` is the 0-based index it was shown) ----


class FactOut(_Base):
    doc: int
    field: FactField
    value: str = Field(max_length=300)
    span: str = Field(max_length=400)


class EventOut(_Base):
    doc: int
    kind: EventKind
    title: str = Field(max_length=200)
    description: str = Field(max_length=400)
    date: str | None = None  # exactly as written in the text, or null
    span: str = Field(max_length=500)


class JobOut(_Base):
    doc: int
    title: str = Field(max_length=200)
    location: str | None = None
    openings: int | None = Field(default=None, ge=1, le=500)
    span: str = Field(max_length=300)


class PersonOut(_Base):
    doc: int
    name: str = Field(max_length=120)
    title: str | None = None
    span: str = Field(max_length=300)


class ExtractionOut(_Base):
    facts: list[FactOut] = Field(default_factory=list)
    events: list[EventOut] = Field(default_factory=list)
    jobs: list[JobOut] = Field(default_factory=list)
    people: list[PersonOut] = Field(default_factory=list)


# ---- verified-span candidates the rest of the pipeline works with ----


class Fact(_Base):
    id: str
    field: FactField
    value: str
    doc_url: str
    span: str


class Event(_Base):
    id: str
    kind: EventKind
    title: str
    description: str
    date: str | None
    doc_url: str
    span: str


class JobPosting(_Base):
    id: str
    title: str
    function: str | None
    location: str | None
    posted_at: str | None
    url: str | None
    openings: int = 1
    doc_url: str
    span: str


class PersonFact(_Base):
    id: str
    name: str
    title: str | None
    doc_url: str
    span: str


class Extracted(_Base):
    facts: list[Fact] = Field(default_factory=list)
    events: list[Event] = Field(default_factory=list)
    jobs: list[JobPosting] = Field(default_factory=list)
    people: list[PersonFact] = Field(default_factory=list)
