"""Deterministic canned results for developing the Next.js side (ENGINE_FAKE_MODE=1) — no network, no LLM.

Fixture companies (by domain):
  acme.example      rich: verified hiring + expansion signals, outreach angle
  thin.example      one fact, no signals, outreach `insufficient_evidence`
  homonym.example   ambiguous entity: an unverified signal is returned flagged (never used in scores)
  none.example      nothing found
  quota.example     fails with QUOTA_EXCEEDED       slow.example  runs ~30 s (cancellable)
  partial.example   budget exhausted → partial result + warning
Anything else behaves like `thin.example` with the requested company name.
"""

from __future__ import annotations

import asyncio
import hashlib
from datetime import UTC, date, datetime

from app.contracts.common import STAGES, ErrorCode, SignalType, SourceType, UsageItem
from app.contracts.result import (
    CompanyProfile,
    Evidence,
    FieldValue,
    Outreach,
    Person,
    ResearchResult,
    Signal,
    Verification,
    WhyFitItem,
)
from app.contracts.runs import RunRequest
from app.errors import EngineError
from app.pipeline.context import PipelineContext
from app.scoring import taxonomy
from app.scoring.icp import Attributes, score_icp
from app.scoring.intent import SignalInput, score_intent

NOW = datetime(2026, 9, 24, 10, 0, tzinfo=UTC)
AS_OF = date(2026, 9, 24)


def _evidence(
    idx: int,
    claim: str,
    url: str,
    title: str,
    stype: SourceType,
    snippet: str,
    *,
    verified: bool = True,
    confidence: float = 0.94,
    notes: list[str] | None = None,
) -> Evidence:
    methods = (
        ["url_fetched", "snippet_present", "entity_match", "entailment", "recency"]
        if verified
        else ["url_fetched"]
    )
    return Evidence(
        id=f"ev_{idx}",
        claim=claim,
        source_url=url,
        source_title=title,
        source_type=stype,
        snippet=snippet,
        content_hash="sha256:" + hashlib.sha256(snippet.encode()).hexdigest(),
        captured_at=NOW,
        verification=Verification(
            verified=verified, confidence=confidence, method=methods, checked_at=NOW, notes=notes or []
        ),
    )


class FakePipeline:
    async def execute(self, ctx: PipelineContext) -> ResearchResult:
        req = ctx.request
        domain = (req.input.company.domain or "").lower()
        for stage in STAGES:
            await ctx.progress(stage)
            await asyncio.sleep(0.01)
        if domain == "quota.example":
            raise EngineError(ErrorCode.QUOTA_EXCEEDED, "LLM quota exceeded (fake fixture)", retryable=False)
        if domain == "slow.example":
            for _ in range(300):
                ctx.check_cancelled()
                await asyncio.sleep(0.1)
        ctx.add_usage(
            UsageItem(
                kind="llm",
                provider="fake",
                model="fake-1",
                units=1,
                tokens_in=1200,
                tokens_out=300,
                cost_estimate=0.004,
            )
        )
        ctx.add_usage(UsageItem(kind="fetch", provider="fake", units=4))
        result = _build(
            req.input.company.name, domain, req.input.lead.model_dump() if req.input.lead else None, req
        )
        if domain == "partial.example":
            result.warnings.append("budget_exhausted:max_pages")
        return result


def _build(name: str, domain: str, lead: dict[str, str | None] | None, req: RunRequest) -> ResearchResult:
    rich = domain == "acme.example"
    homonym = domain == "homonym.example"
    nothing = domain == "none.example"
    evidence: list[Evidence] = []
    signals: list[Signal] = []
    fields: list[FieldValue] = []
    people: list[Person] = []
    employees: int | None = None
    industry: str | None = None
    location: str | None = None
    description: str | None = None
    unknowns: list[str] = []
    warnings: list[str] = []

    if rich:
        evidence = [
            _evidence(
                1,
                "Acme has 8 open Sales Development Representative roles",
                "https://acme.example/careers",
                "Careers — Acme",
                SourceType.CAREERS,
                "Sales Development Representative (8 openings) — Bengaluru",
            ),
            _evidence(
                2,
                "Acme announced expansion into the US",
                "https://acme.example/news/us-expansion",
                "Acme opens US office",
                SourceType.PRESS_RELEASE,
                "Acme today announced the opening of its first US office in Austin.",
                confidence=0.9,
            ),
            _evidence(
                3,
                "Acme has about 120 employees",
                "https://acme.example/about",
                "About Acme",
                SourceType.WEBSITE,
                "We are a team of 120 people across Bengaluru and Austin.",
            ),
            _evidence(
                4,
                "Acme builds outbound sales software",
                "https://acme.example/",
                "Acme — outbound platform",
                SourceType.WEBSITE,
                "Acme is a B2B SaaS platform that helps outbound teams book meetings.",
            ),
        ]
        employees, industry, location = 120, "B2B SaaS", "Bengaluru, IN"
        description = "B2B SaaS platform for outbound sales teams."
        fields = [
            FieldValue(field="employee_count", value="120", evidence_ids=["ev_3"]),
            FieldValue(field="industry", value="B2B SaaS", evidence_ids=["ev_4"]),
            FieldValue(field="location", value="Bengaluru, IN", evidence_ids=["ev_3"]),
        ]
        signals = [
            Signal(
                id="sg_1",
                type=SignalType.HIRING,
                title="Hiring 8 SDRs",
                description="8 open SDR roles",
                detected_at=date(2026, 9, 20),
                confidence=0.94,
                verified=True,
                evidence_ids=["ev_1"],
            ),
            Signal(
                id="sg_2",
                type=SignalType.EXPANSION,
                title="US expansion",
                description="Opened a US office",
                detected_at=date(2026, 9, 12),
                confidence=0.9,
                verified=True,
                evidence_ids=["ev_2"],
            ),
        ]
        if lead:
            evidence.append(
                _evidence(
                    5,
                    f"{lead['name']} is {lead.get('title') or 'on the team'} at Acme",
                    "https://acme.example/team",
                    "Team — Acme",
                    SourceType.WEBSITE,
                    f"{lead['name']} — {lead.get('title') or 'Team'}",
                )
            )
            people = [
                Person(
                    name=str(lead["name"]),
                    title=lead.get("title"),
                    relevance="owns sales development",
                    evidence_ids=["ev_5"],
                )
            ]
    elif homonym:
        evidence = [
            _evidence(
                1,
                "Homonym Ltd has 40 employees",
                "https://homonym.example/about",
                "About",
                SourceType.WEBSITE,
                "Our company has 40 employees.",
                confidence=0.95,
            ),
            _evidence(
                2,
                "Homonym raised a Series B",
                "https://news.example/other-homonym",
                "Other company raises",
                SourceType.NEWS,
                "Homonym Inc. (Boston) raised a Series B.",
                verified=False,
                confidence=0.3,
                notes=["entity_match: source is about a different company (different domain/HQ)"],
            ),
        ]
        employees, description = 40, "Small company."
        fields = [FieldValue(field="employee_count", value="40", evidence_ids=["ev_1"])]
        signals = [
            Signal(
                id="sg_1",
                type=SignalType.FUNDING,
                title="Series B (unverified)",
                detected_at=date(2026, 8, 1),
                confidence=0.3,
                verified=False,
                evidence_ids=["ev_2"],
            )
        ]
        warnings = ["ambiguous_entity"]
        unknowns = ["industry", "location"]
    elif nothing:
        unknowns = ["industry", "employee_count", "location", "funding", "hiring"]
    else:  # thin / default
        evidence = [
            _evidence(
                1,
                f"{name} is a company",
                f"https://{domain or 'thin.example'}/",
                name,
                SourceType.WEBSITE,
                f"Welcome to {name}.",
                confidence=0.8,
            )
        ]
        description = f"{name} (limited public information)."
        fields = [FieldValue(field="name", value=name, evidence_ids=["ev_1"])]
        unknowns = ["industry", "employee_count", "location", "funding", "hiring"]

    attrs = Attributes(
        industry=taxonomy.normalize_industry(industry),
        country=taxonomy.normalize_country(location),
        employee_count=employees,
        domain=domain or None,
        seniority=taxonomy.normalize_title(lead.get("title") if lead else None)[0],
        function=taxonomy.normalize_title(lead.get("title") if lead else None)[1],
        title_text=lead.get("title") if lead else None,
        has_person=bool(lead and lead.get("title")),
        evidence={
            "industry": ["ev_4"] if rich else [],
            "employee_count": ["ev_3"] if rich else [],
            "country": ["ev_3"] if rich else [],
            "title": ["ev_5"] if rich and lead else [],
        },
    )
    icp = score_icp(req.context.icp, attrs)
    intent = score_intent(
        [SignalInput(s.type, s.confidence, s.detected_at, s.verified, s.id) for s in signals], AS_OF
    )
    excluded = any(i.criterion == "exclusion" for i in icp.breakdown)
    outreach = Outreach(
        insufficient_evidence=True,
        why_now="No recent verified triggers found.",
        why_contact=f"{name} could be relevant based on limited public information.",
        recommended_angle="Lead with a role-relevant, low-pressure question.",
    )
    if rich:
        outreach = Outreach(
            insufficient_evidence=False,
            why_contact="Acme sells outbound tooling, adjacent to our offer.",
            why_now="Acme has 8 open SDR roles and announced a US expansion in September 2026.",
            why_person=(
                f"{lead['name']} ({lead.get('title')}) owns sales development."
                if lead
                else "Sales leadership owns SDR hiring."
            ),
            potential_problem="Rapid SDR growth may strain pipeline efficiency.",
            recommended_angle="Lead with qualified pipeline per SDR rather than generic lead generation.",
            evidence_ids=["ev_1", "ev_2"] + (["ev_5"] if lead else []),
        )
    why_fit = [
        WhyFitItem(
            criterion=i.criterion,
            status=i.status,
            text=f"{i.criterion}: {i.value_found or 'unknown'}",
            evidence_ids=i.evidence_ids,
        )
        for i in icp.breakdown
        if i.criterion != "exclusion"
    ]
    return ResearchResult(
        company=CompanyProfile(
            name=name,
            domain=domain or None,
            industry=industry,
            employee_band="51-200" if employees and 51 <= employees <= 200 else None,
            location=location,
            description=description,
            fields=fields,
        ),
        people=people,
        signals=signals,
        evidence=evidence,
        icp=icp,
        intent=intent,
        qualified=(not excluded) and icp.score >= req.context.icp.min_score_to_qualify,
        why_fit=why_fit,
        outreach=outreach,
        unknowns=unknowns,
        warnings=warnings,
    )
