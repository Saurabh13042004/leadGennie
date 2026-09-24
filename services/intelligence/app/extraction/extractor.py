"""Turns captured documents into *candidate* facts/events/jobs/people, each with a verified `source_span`.
Deterministic first (ATS job boards), LLM-structured second. Extraction never invents: an item whose span
is not actually present in its document is dropped."""

from __future__ import annotations

from collections.abc import Callable

from app.contracts.common import ErrorCode, SourceType
from app.documents import RawDocument
from app.errors import EngineError
from app.evidence.matching import extract_numbers, find_span, normalize
from app.extraction.models import Event, Extracted, ExtractionOut, Fact, JobPosting, PersonFact
from app.injection import scan_for_injection
from app.llm.client import LlmClient
from app.llm.prompts import extraction as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.scoring import taxonomy
from app.sources.jobs import job_line
from app.urls import registrable_domain

MAX_CHARS_PER_DOC = 6000
MAX_CHARS_PER_BATCH = 24_000
MAX_BATCHES = 2
_REDACTED = "[instruction-like text removed]"

_PRIORITY = {
    SourceType.WEBSITE: 0,
    SourceType.CAREERS: 1,
    SourceType.PRESS_RELEASE: 2,
    SourceType.NEWS: 3,
    SourceType.SEARCH: 4,
    SourceType.PUBLIC_DATA: 5,
    SourceType.JOBS_BOARD: 9,
}


def redact_instructions(text: str) -> str:
    """Prompt-injection hygiene: lines that look like instructions to a model are replaced before prompting."""
    return "\n".join(_REDACTED if scan_for_injection(line) else line for line in text.splitlines())


def _render(docs: list[RawDocument], start: int) -> str:
    parts = []
    for i, d in enumerate(docs, start=start):
        published = d.published_at.date().isoformat() if d.published_at else "unknown"
        parts.append(
            f'<document index="{i}" url="{d.url}" type="{d.source_type.value}" published="{published}">\n'
            f"{redact_instructions(d.text[:MAX_CHARS_PER_DOC])}\n</document>"
        )
    return "\n\n".join(parts)


class Extractor:
    def __init__(self, llm: LlmClient) -> None:
        self._llm = llm

    async def extract(
        self, ctx: PipelineContext, company: str, domain: str | None, docs: list[RawDocument]
    ) -> Extracted:
        out = Extracted()
        counters = {"f": 0, "e": 0, "j": 0, "p": 0}

        def nid(kind: str) -> str:
            counters[kind] += 1
            return f"{kind}_{counters[kind]}"

        async with ctx.step("extracting", tool="extract", input_summary=f"{len(docs)} documents") as step:
            self._ats_jobs(docs, out, nid)
            llm_docs = sorted(
                (d for d in docs if d.source_type != SourceType.JOBS_BOARD),
                key=lambda d: (
                    0 if domain and registrable_domain(d.final_url) == registrable_domain(domain) else 1,
                    _PRIORITY.get(d.source_type, 6),
                ),
            )
            dropped = 0
            for batch, offset in self._batches(llm_docs):
                ctx.check_cancelled()
                try:
                    result = await self._llm.generate(
                        ctx,
                        task="extract",
                        system=prompt.SYSTEM,
                        schema=ExtractionOut,
                        user=prompt.user_prompt(company, domain, "", _render(batch, offset)),
                    )
                except BudgetExhausted:
                    ctx.warn("budget_exhausted:max_llm_calls")
                    break
                except EngineError as exc:
                    if exc.code in (ErrorCode.QUOTA_EXCEEDED, ErrorCode.UNAVAILABLE) and not exc.retryable:
                        raise
                    ctx.warn(f"extraction_batch_failed:{exc.code}")
                    continue
                dropped += self._verify(result, batch, offset, out, nid)
            self._dedupe(out)
            step["output_summary"] = (
                f"facts={len(out.facts)} events={len(out.events)} jobs={len(out.jobs)} "
                f"people={len(out.people)} dropped_unverifiable_spans={dropped}"
            )
        return out

    # -- internals ------------------------------------------------------------------------------------

    @staticmethod
    def _batches(docs: list[RawDocument]) -> list[tuple[list[RawDocument], int]]:
        batches: list[tuple[list[RawDocument], int]] = []
        current: list[RawDocument] = []
        size, start = 0, 0
        for i, d in enumerate(docs):
            n = min(len(d.text), MAX_CHARS_PER_DOC)
            if current and size + n > MAX_CHARS_PER_BATCH:
                batches.append((current, start))
                current, size, start = [], 0, i
            current.append(d)
            size += n
        if current:
            batches.append((current, start))
        return batches[:MAX_BATCHES]

    @staticmethod
    def _ats_jobs(docs: list[RawDocument], out: Extracted, nid: NextId) -> None:
        for d in docs:
            if d.source_type != SourceType.JOBS_BOARD:
                continue
            for job in d.metadata.get("jobs", []):
                title = str(job.get("title") or "")
                if not title:
                    continue
                span = job_line(job)
                if not find_span(span, d.text)[0]:
                    continue
                out.jobs.append(
                    JobPosting(
                        id=nid("j"),
                        title=title,
                        function=taxonomy.normalize_function(str(job.get("department") or ""))
                        or taxonomy.normalize_title(title)[1],
                        location=job.get("location"),
                        posted_at=job.get("posted_at"),
                        url=job.get("url"),
                        openings=1,
                        doc_url=d.url,
                        span=span,
                    )
                )

    def _verify(
        self, result: ExtractionOut, batch: list[RawDocument], offset: int, out: Extracted, nid: NextId
    ) -> int:
        dropped = 0

        def doc_for(idx: int) -> RawDocument | None:
            return batch[idx - offset] if 0 <= idx - offset < len(batch) else None

        def ok(idx: int, span: str) -> RawDocument | None:
            d = doc_for(idx)
            return d if d is not None and find_span(span, d.text)[0] else None

        for f in result.facts:
            if d := ok(f.doc, f.span):
                out.facts.append(
                    Fact(
                        id=nid("f"), field=f.field, value=f.value.strip(), doc_url=d.url, span=f.span.strip()
                    )
                )
            else:
                dropped += 1
        for e in result.events:
            if d := ok(e.doc, e.span):
                date = (
                    e.date if e.date and normalize(e.date) in normalize(d.text) else None
                )  # a stated date must really be stated
                out.events.append(
                    Event(
                        id=nid("e"),
                        kind=e.kind,
                        title=e.title.strip(),
                        description=e.description.strip(),
                        date=date,
                        doc_url=d.url,
                        span=e.span.strip(),
                    )
                )
            else:
                dropped += 1
        for j in result.jobs:
            if d := ok(j.doc, j.span):
                openings = j.openings if j.openings and float(j.openings) in extract_numbers(j.span) else 1
                out.jobs.append(
                    JobPosting(
                        id=nid("j"),
                        title=j.title.strip(),
                        function=taxonomy.normalize_title(j.title)[1],
                        location=j.location,
                        posted_at=None,
                        url=None,
                        openings=openings,
                        doc_url=d.url,
                        span=j.span.strip(),
                    )
                )
            else:
                dropped += 1
        for p in result.people:
            if d := ok(p.doc, p.span):
                out.people.append(
                    PersonFact(
                        id=nid("p"), name=p.name.strip(), title=p.title, doc_url=d.url, span=p.span.strip()
                    )
                )
            else:
                dropped += 1
        return dropped

    @staticmethod
    def _dedupe(out: Extracted) -> None:
        out.facts = _unique(out.facts, lambda f: f"{f.field}|{normalize(f.value)}")
        out.events = _unique(out.events, lambda e: normalize(e.title))
        out.people = _unique(out.people, lambda p: normalize(p.name))


NextId = Callable[[str], str]


def _unique[T](items: list[T], key: Callable[[T], str]) -> list[T]:
    seen: set[str] = set()
    out: list[T] = []
    for item in items:
        k = key(item)
        if k not in seen:
            seen.add(k)
            out.append(item)
    return out
