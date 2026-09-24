"""ResearchPipeline: the real executor. Stages (each traced, budgeted, cancellable):

  collecting -> extracting -> researching -> signals -> validating -> scoring -> outreach

Agents propose; the Evidence Validator decides what is verified; scoring and outreach consume verified data only.
A budget hit anywhere degrades to a partial result plus a warning — it never fails silently and never overruns."""

from __future__ import annotations

import asyncio
import re
from datetime import UTC, date

from app.agents.outreach import OutreachAgent
from app.agents.qualification import QualificationAgent, VerifiedProfile
from app.agents.research import ProfileCandidates, ResearchAgent, employee_band
from app.agents.signal import CandidateSignal, SignalAgent
from app.config import Settings
from app.contracts.common import RunTask, SignalType
from app.contracts.icp import Icp
from app.contracts.result import (
    CompanyProfile,
    FieldValue,
    Outreach,
    Person,
    ResearchResult,
    ScoringInputs,
    Signal,
)
from app.documents import RawDocument
from app.evidence.models import Claim, ClaimVerdict
from app.evidence.validator import EvidenceValidator
from app.extraction.extractor import Extractor
from app.extraction.models import Extracted
from app.llm.client import LlmClient
from app.pipeline.book import EvidenceBook
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.pipeline.planner import news_queries, plan_queries, web_queries
from app.scoring import taxonomy
from app.scoring.intent import SignalInput
from app.sources.base import Collector, CollectQuery
from app.sources.fetch import Fetcher
from app.sources.jobs import JobsCollector
from app.sources.news import NewsCollector
from app.sources.search import SearchProvider, WebSearchCollector
from app.sources.website import WebsiteCollector
from app.telemetry.logging import get_logger

log = get_logger(__name__)


def clean_domain(value: str | None) -> str | None:
    if not value:
        return None
    v = re.sub(r"^https?://", "", value.strip().lower()).split("/")[0].removeprefix("www.")
    return v or None


class ResearchPipeline:
    def __init__(self, settings: Settings, fetcher: Fetcher, search: SearchProvider, llm: LlmClient) -> None:
        self._s, self._fetcher, self._search, self._llm = settings, fetcher, search, llm

    async def execute(self, ctx: PipelineContext) -> ResearchResult:
        req = ctx.request
        company_in, lead = req.input.company, req.input.lead
        name, domain = company_in.name, clean_domain(company_in.domain)
        icp = req.context.icp
        offer_kw = list(req.context.offer_keywords)
        query = CollectQuery(
            name,
            domain,
            lead.name if lead else None,
            tuple(offer_kw),
            freshness_seconds=req.input.freshness_days * 86400.0,
        )

        # 1) collect ---------------------------------------------------------------------------------------
        await ctx.progress("collecting")
        await self._collect(ctx, query, offer_kw, lead.title if lead else None)
        docs = ctx.docs.documents()

        # 2) extract ---------------------------------------------------------------------------------------
        await ctx.progress("extracting")
        extracted = Extracted()
        if docs:
            try:
                extracted = await Extractor(self._llm).extract(ctx, name, domain, docs)
            except BudgetExhausted as exc:
                ctx.warn(f"budget_exhausted:{exc.reason}")
        else:
            ctx.warn("no_sources_collected")

        # 3) research + 4) signals (propose only) ---------------------------------------------------------
        await ctx.progress("researching")
        profile_c = None
        signals_c: list[CandidateSignal] = []
        try:
            profile_c = await ResearchAgent(self._llm).propose(
                ctx,
                ctx.docs,
                name,
                domain,
                company_in.location,
                extracted,
                synthesize=req.task != RunTask.FIND_SIGNALS,
            )
            await ctx.progress("signals")
            icp_functions = {f for t in icp.titles for f in t.function}
            signals_c = await SignalAgent(self._llm).propose(
                ctx,
                ctx.docs,
                name,
                domain,
                company_in.location,
                extracted,
                req.context.positioning,
                icp_functions,
            )
        except BudgetExhausted as exc:
            ctx.warn(f"budget_exhausted:{exc.reason}")

        # 5) validate ---------------------------------------------------------------------------------------
        await ctx.progress("validating")
        validator = EvidenceValidator(ctx.docs, self._llm, self._s)
        claims: list[Claim] = [*(profile_c.claims if profile_c else []), *[s.claim for s in signals_c]]
        verdicts: dict[str, ClaimVerdict] = {}
        if claims:
            try:
                verdicts = {v.claim.id: v for v in await validator.validate(ctx, claims)}
            except BudgetExhausted as exc:
                ctx.warn(f"budget_exhausted:{exc.reason}")

        book = EvidenceBook(ctx.docs)
        company, fields, unknowns = self._profile(ctx, name, domain, profile_c, verdicts, book)
        people = self._people(profile_c, verdicts, book, lead.name if lead else None, icp)
        signals = self._signals(ctx, signals_c, verdicts, book)

        # 6) score (deterministic, verified data only) -----------------------------------------------------
        await ctx.progress("scoring")
        verified_texts = [e.claim + " " + e.snippet for e in book.rows if e.verification.verified]
        person_title = (
            lead.title
            if lead and lead.title
            else next((p.title for p in people if lead and p.name.casefold() == lead.name.casefold()), None)
        )
        vp = VerifiedProfile(
            domain=domain,
            industry_text=company.industry,
            location_text=company.location,
            employee_count=_int(fields.get("employee_count")),
            person_title=person_title,
            has_person=bool(lead),
            evidence_texts=verified_texts,
            evidence={
                "industry": _ids(verdicts, book, "field:industry"),
                "employee_count": _ids(verdicts, book, "field:employee_count"),
                "country": _ids(verdicts, book, "field:location"),
                "title": [],
            },
        )
        qual = await QualificationAgent(self._llm).qualify(
            ctx,
            icp,
            vp,
            [SignalInput(s.type, s.confidence, s.detected_at, True, s.id) for s in signals if s.verified],
        )

        # 7) outreach (lead research only) --------------------------------------------------------------------
        await ctx.progress("outreach")
        outreach = Outreach(insufficient_evidence=True)
        if req.task == RunTask.LEAD_RESEARCH:
            try:
                outreach = await OutreachAgent(self._llm, validator).prepare(
                    ctx,
                    company=name,
                    domain=domain,
                    location=company_in.location,
                    person_name=lead.name if lead else None,
                    person_title=person_title,
                    positioning=req.context.positioning,
                    offer_keywords=offer_kw,
                    verified=book.rows,
                    signals=signals,
                )
            except BudgetExhausted as exc:
                ctx.warn(f"budget_exhausted:{exc.reason}")

        if not any(s.type == SignalType.FUNDING and s.verified for s in signals):
            unknowns.append("funding history")
        if not any(s.type in (SignalType.HIRING, SignalType.JOB_POSTING) and s.verified for s in signals):
            unknowns.append("hiring activity")
        return ResearchResult(
            company=company,
            people=people,
            signals=signals,
            evidence=book.rows,
            icp=qual.icp,
            intent=qual.intent,
            qualified=qual.qualified,
            scoring_inputs=ScoringInputs(
                industry=qual.industry_key,
                country=qual.country,
                employee_count=vp.employee_count,
                keywords_found=qual.keywords_found,
                person_title=person_title,
            ),
            why_fit=qual.why_fit,
            outreach=outreach,
            unknowns=list(dict.fromkeys(unknowns)),
            warnings=list(dict.fromkeys([*ctx.warnings, *(profile_c.conflicts if profile_c else [])])),
        )

    # -- collection -------------------------------------------------------------------------------------------

    async def _collect(
        self, ctx: PipelineContext, query: CollectQuery, offer_kw: list[str], lead_title: str | None
    ) -> None:
        role_kw = [k for k in offer_kw if re.search(r"sdr|sales|bdr|account exec", k, re.I)] or offer_kw[:2]
        planned = plan_queries(query.company_name, query.domain, offer_kw, role_kw)
        async with ctx.step(
            "collecting", tool="website", input_summary=query.domain or query.company_name
        ) as step:
            try:
                web_docs = await WebsiteCollector(self._fetcher).collect(ctx, query)
            except BudgetExhausted as exc:
                ctx.warn(f"budget_exhausted:{exc.reason}")
                web_docs = []
            step["output_summary"] = f"{len(web_docs)} pages"
        collectors: list[Collector] = [
            JobsCollector(self._fetcher),
            WebSearchCollector(self._search, self._fetcher, web_queries(planned)),
            NewsCollector(self._search, self._fetcher, news_queries(planned)),
        ]
        results = await asyncio.gather(*(self._run_collector(ctx, c, query) for c in collectors))
        log.info(
            "collected",
            docs=len(ctx.docs),
            by_collector=dict(zip(("jobs", "web_search", "news"), results, strict=True)),
        )

    async def _run_collector(self, ctx: PipelineContext, collector: Collector, query: CollectQuery) -> int:
        async with ctx.step("collecting", tool=collector.name) as step:
            try:
                docs: list[RawDocument] = await collector.collect(ctx, query)
            except BudgetExhausted as exc:
                ctx.warn(f"budget_exhausted:{exc.reason}")
                docs = []
            except Exception as exc:
                if type(exc).__name__ == "RunCanceled":
                    raise
                ctx.warn(f"collector_failed:{collector.name}")
                log.warning("collector_failed", collector=collector.name, error=type(exc).__name__)
                docs = []
            step["output_summary"] = f"{len(docs)} documents"
            return len(docs)

    # -- assembly ---------------------------------------------------------------------------------------------

    def _profile(
        self,
        ctx: PipelineContext,
        name: str,
        domain: str | None,
        cand: ProfileCandidates | None,
        verdicts: dict[str, ClaimVerdict],
        book: EvidenceBook,
    ) -> tuple[CompanyProfile, dict[str, str], list[str]]:
        fields: dict[str, str] = {}
        field_values: list[FieldValue] = []
        unknowns: list[str] = []
        products: list[str] = []
        text_fields: dict[str, str] = {}
        if cand is not None:
            for claim in cand.claims:
                if not claim.id.startswith("field:"):
                    continue
                v = verdicts.get(claim.id)
                key = claim.id.split(":", 1)[1]
                if v is None or not v.verified:
                    if not key.startswith("product"):
                        unknowns.append(key)
                        ctx.warn(f"unverified_field:{key}")
                    continue
                value = cand.values.get(claim.id, v.text)
                ids = book.ids_for(v)
                if key.startswith("product"):
                    products.append(value)
                    field_values.append(FieldValue(field="product", value=value, evidence_ids=ids))
                    continue
                if key in ("description", "market", "business_model"):
                    text_fields[key] = v.text
                else:
                    fields[key] = value
                field_values.append(
                    FieldValue(field=key, value=v.text if key in text_fields else value, evidence_ids=ids)
                )
        count = _int(fields.get("employee_count"))
        for missing in ("industry", "employee_count", "location"):
            if missing not in fields and missing not in unknowns:
                unknowns.append(missing)
        company = CompanyProfile(
            name=name,
            domain=domain,
            industry=fields.get("industry"),
            employee_band=employee_band(count) if count else None,
            location=fields.get("location"),
            description=text_fields.get("description"),
            products=products[:8],
            market=text_fields.get("market"),
            business_model=text_fields.get("business_model"),
            fields=field_values,
        )
        return company, fields, unknowns

    def _people(
        self,
        cand: ProfileCandidates | None,
        verdicts: dict[str, ClaimVerdict],
        book: EvidenceBook,
        lead_name: str | None,
        icp: Icp,
    ) -> list[Person]:
        if cand is None:
            return []
        out: list[tuple[int, Person]] = []
        wanted_seniority = {s for t in icp.titles for s in t.seniority}
        wanted_function = {f for t in icp.titles for f in t.function}
        for cid, pf in cand.people_claims.items():
            v = verdicts.get(cid)
            if v is None or not v.verified:
                continue
            seniority, function = taxonomy.normalize_title(pf.title)
            if lead_name and pf.name.casefold() == lead_name.casefold():
                rank, why = 0, "the lead being researched"
            elif (
                (not wanted_seniority or seniority in wanted_seniority)
                and (not wanted_function or function in wanted_function)
                and pf.title
            ):
                rank, why = 1, "matches the target role in your ICP"
            else:
                rank, why = 2, "named on the company's public pages"
            out.append(
                (rank, Person(name=pf.name, title=pf.title, relevance=why, evidence_ids=book.ids_for(v)))
            )
        return [p for _, p in sorted(out, key=lambda x: x[0])][:5]

    def _signals(
        self,
        ctx: PipelineContext,
        cands: list[CandidateSignal],
        verdicts: dict[str, ClaimVerdict],
        book: EvidenceBook,
    ) -> list[Signal]:
        out: list[Signal] = []
        key_to_id: dict[str, str] = {}
        dropped = 0
        for c in cands:
            v = verdicts.get(c.claim.id)
            if v is None or not v.fetched_refs:
                dropped += 1  # nothing we actually fetched backs it: never surfaced, not even flagged
                continue
            sid = f"sg_{len(out) + 1}"
            key_to_id[c.key] = sid
            detected: date | None = c.detected_at.astimezone(UTC).date() if c.detected_at else None
            out.append(
                Signal(
                    id=sid,
                    type=c.type,
                    title=c.title,
                    description=c.description,
                    detected_at=detected,
                    confidence=v.confidence if v.verified else min(v.confidence, 0.69),
                    verified=v.verified,
                    evidence_ids=book.ids_for(v),
                )
            )
        for c in cands:
            if c.conflicts_with and c.key in key_to_id:
                sig = next(s for s in out if s.id == key_to_id[c.key])
                sig.conflicts_with = [key_to_id[k] for k in c.conflicts_with if k in key_to_id]
        if dropped:
            ctx.warn(f"dropped_unverifiable_signals:{dropped}")
        return out


def _int(value: str | None) -> int | None:
    if not value:
        return None
    digits = re.sub(r"[^\d]", "", value.split("-")[0].split("–")[0])
    return int(digits) if digits else None


def _ids(verdicts: dict[str, ClaimVerdict], book: EvidenceBook, claim_id: str) -> list[str]:
    v = verdicts.get(claim_id)
    return book.ids_for(v) if v is not None and v.verified else []
