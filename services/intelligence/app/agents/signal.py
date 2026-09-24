"""Signal Agent: candidate buying signals from extracted events and job postings.

Deterministic criteria first (job counts come from structured postings, never from a model; every candidate
needs evidence; recency windows apply); an LLM only confirms relevance/type of *events*. It proposes; the Evidence
Validator decides what is verified. It does not fetch."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict

from app import clock
from app.contracts.common import SignalType
from app.dates import parse_stated_date
from app.documents import DocumentSet
from app.errors import EngineError
from app.evidence.matching import extract_numbers, normalize
from app.evidence.models import Claim, EvidenceRef
from app.evidence.recency import WINDOW_DAYS
from app.extraction.models import Event, Extracted, JobPosting
from app.llm.client import LlmClient
from app.llm.prompts import signals as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext

_KIND_TO_TYPE: dict[str, SignalType] = {
    "funding": SignalType.FUNDING,
    "expansion": SignalType.EXPANSION,
    "product_launch": SignalType.PRODUCT_LAUNCH,
    "leadership_change": SignalType.LEADERSHIP_CHANGE,
    "tech_change": SignalType.TECH_CHANGE,
    "news": SignalType.NEWS,
}
_NEGATIVE = re.compile(
    r"\b(layoffs?|laid off|lays off|hiring freeze|downsiz\w+|shuts? down|bankrupt\w*)\b", re.I
)
_RELEVANT_FUNCTIONS = ("sales", "marketing")


class _Decision(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str
    relevant: bool
    type: SignalType | None = None
    rationale: str = ""


class ClassificationOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    decisions: list[_Decision]


@dataclass
class CandidateSignal:
    key: str
    type: SignalType
    title: str
    description: str
    detected_at: datetime | None
    claim: Claim
    conflicts_with: list[str] = field(default_factory=list)


class SignalAgent:
    def __init__(self, llm: LlmClient) -> None:
        self._llm = llm

    async def propose(
        self,
        ctx: PipelineContext,
        docs: DocumentSet,
        company: str,
        domain: str | None,
        location: str | None,
        extracted: Extracted,
        offer: str,
        icp_functions: set[str] | None = None,
    ) -> list[CandidateSignal]:
        out: list[CandidateSignal] = []
        out.extend(self._hiring(docs, company, domain, location, extracted.jobs, icp_functions or set()))
        out.extend(await self._events(ctx, docs, company, domain, location, extracted.events, offer))
        # A negative event (layoffs, freeze) conflicts with any hiring signal — surface both, never hide either.
        negatives = [
            s.key
            for s in out
            if s.type == SignalType.NEWS and _NEGATIVE.search(s.title + " " + s.description)
        ]
        for s in out:
            if s.type in (SignalType.HIRING, SignalType.JOB_POSTING) and negatives:
                s.conflicts_with = negatives
        return out

    # -- hiring: deterministic ------------------------------------------------------------------------

    def _hiring(
        self,
        docs: DocumentSet,
        company: str,
        domain: str | None,
        location: str | None,
        jobs: list[JobPosting],
        icp_functions: set[str],
    ) -> list[CandidateSignal]:
        seen: set[tuple[str, str]] = set()
        unique: list[JobPosting] = []
        for j in jobs:  # dedupe the same posting seen on an ATS board and on the careers page
            k = (normalize(j.title), normalize(j.location or ""))
            if k not in seen:
                seen.add(k)
                unique.append(j)
        by_function: dict[str, list[JobPosting]] = {}
        for j in unique:
            by_function.setdefault(j.function or "other", []).append(j)
        relevant = set(_RELEVANT_FUNCTIONS) | icp_functions
        signals: list[CandidateSignal] = []
        for function, group in sorted(by_function.items()):
            if function not in relevant and len(group) < 3:
                continue
            total = sum(j.openings for j in group)
            stype = SignalType.HIRING if function in relevant else SignalType.JOB_POSTING
            label = function.replace("_", " ")
            samples = group[:3]
            posted = [d for j in group if (d := parse_stated_date(j.posted_at) or _iso(j.posted_at))]
            doc = docs.get(group[0].doc_url)
            detected = max(posted) if posted else (doc.fetched_at if doc else clock.now())
            listing = "; ".join(f"{j.title} ({j.location})" if j.location else j.title for j in samples)
            claim = Claim(
                id=f"signal:hiring:{function}",
                text=f"{company} has open {label} roles",  # the COUNT is derived from the structured listing, not asserted here
                type="job",
                refs=[EvidenceRef(j.doc_url, j.span) for j in samples],
                company_name=company,
                company_domain=domain,
                company_location=location,
                signal_type=stype,
                source_date=detected,
            )
            signals.append(
                CandidateSignal(
                    key=f"hiring:{function}",
                    type=stype,
                    title=f"Hiring {total} {label} role{'s' if total != 1 else ''}",
                    description=f"{total} open {label} role(s) found in the public listing, e.g. {listing}.",
                    detected_at=detected,
                    claim=claim,
                )
            )
        return signals

    # -- events: LLM confirms relevance/type, code applies windows and merges corroboration -------------

    async def _events(
        self,
        ctx: PipelineContext,
        docs: DocumentSet,
        company: str,
        domain: str | None,
        location: str | None,
        events: list[Event],
        offer: str,
    ) -> list[CandidateSignal]:
        if not events:
            return []
        decisions = await self._classify(ctx, company, events, offer)
        candidates: list[tuple[SignalType, Event, datetime | None]] = []
        for e in events:
            d = decisions.get(e.id)
            if d is not None:
                if not d.relevant or d.type is None:
                    continue
                stype: SignalType = d.type
            else:  # LLM unavailable/skipped: fall back to the extraction's own kind, drop "other"
                fallback = _KIND_TO_TYPE.get(e.kind)
                if fallback is None:
                    continue
                stype = fallback
            doc = docs.get(e.doc_url)
            when = parse_stated_date(e.date) or (doc.published_at if doc else None)
            if when is not None and (clock.now() - when).days > 2 * WINDOW_DAYS[stype]:
                continue  # already expired: not worth a claim
            candidates.append((stype, e, when))

        merged: dict[tuple[SignalType, str], list[tuple[Event, datetime | None]]] = {}
        for stype, e, when in candidates:
            nums = ",".join(f"{n:g}" for n in sorted(extract_numbers(e.title + " " + e.description)))
            key = (stype, nums or normalize(e.title)[:60])
            merged.setdefault(key, []).append((e, when))
        out: list[CandidateSignal] = []
        for (stype, _k), group in merged.items():
            best, when = group[0]
            dates = [w for _, w in group if w]
            detected = max(dates) if dates else None
            claim = Claim(
                id=f"signal:{best.id}",
                text=best.description or best.title,
                type="signal",
                refs=[EvidenceRef(e.doc_url, e.span) for e, _ in group],
                company_name=company,
                company_domain=domain,
                company_location=location,
                signal_type=stype,
                source_date=detected,
            )
            out.append(
                CandidateSignal(
                    key=f"event:{best.id}",
                    type=stype,
                    title=best.title,
                    description=best.description,
                    detected_at=detected,
                    claim=claim,
                )
            )
        return out

    async def _classify(
        self, ctx: PipelineContext, company: str, events: list[Event], offer: str
    ) -> dict[str, _Decision]:
        block = "\n".join(f'[{e.id}] {e.title} — {e.description} | quote: "{e.span}"' for e in events[:30])
        try:
            out = await self._llm.generate(
                ctx,
                task="signal_classify",
                system=prompt.SYSTEM,
                user=prompt.user_prompt(company, offer, block),
                schema=ClassificationOut,
            )
        except BudgetExhausted:
            ctx.warn("budget_exhausted:max_llm_calls")
            return {}
        except EngineError as exc:
            if not exc.retryable and exc.code.value in ("QUOTA_EXCEEDED", "UNAVAILABLE"):
                raise
            ctx.warn(f"signal_classification_failed:{exc.code}")
            return {}
        return {d.event_id: d for d in out.decisions}


def _iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        if value.isdigit() and len(value) >= 12:  # epoch millis (Lever)
            return datetime.fromtimestamp(int(value) / 1000, tz=UTC)
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)
