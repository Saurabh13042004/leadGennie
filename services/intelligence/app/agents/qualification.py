"""Qualification Agent: normalizes VERIFIED attributes onto the taxonomies and calls the deterministic scorers.
The LLM has one narrow job — mapping free text the rules can't resolve onto allowed enum values. It never
produces a score, a weight, or a met/not-met decision (that is `app.scoring`)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from pydantic import BaseModel, ConfigDict

from app.contracts.icp import Icp
from app.contracts.result import IcpResult, IntentResult, WhyFitItem
from app.errors import EngineError
from app.llm.client import LlmClient
from app.llm.prompts import normalize as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.scoring import taxonomy
from app.scoring.explain import why_fit
from app.scoring.icp import Attributes, score_icp
from app.scoring.intent import SignalInput, score_intent


class NormalizeOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    industry: str | None = None
    country: str | None = None


@dataclass
class VerifiedProfile:
    """Only what passed the Evidence Validator. `evidence` maps attribute -> evidence ids (for the breakdown)."""

    domain: str | None
    industry_text: str | None
    location_text: str | None
    employee_count: int | None
    person_title: str | None
    has_person: bool
    evidence_texts: list[str]  # verified claim texts + snippets, for keyword matching
    evidence: dict[str, list[str]]


@dataclass
class Qualification:
    icp: IcpResult
    intent: IntentResult
    qualified: bool
    why_fit: list[WhyFitItem]
    industry_key: str | None
    country: str | None
    keywords_found: list[str]


class QualificationAgent:
    def __init__(self, llm: LlmClient) -> None:
        self._llm = llm

    async def qualify(
        self, ctx: PipelineContext, icp: Icp, profile: VerifiedProfile, signals: list[SignalInput]
    ) -> Qualification:
        async with ctx.step("scoring", agent="qualification", tool="score") as step:
            industry = taxonomy.normalize_industry(profile.industry_text)
            country = taxonomy.normalize_country(profile.location_text)
            if (industry is None and profile.industry_text) or (country is None and profile.location_text):
                industry, country = await self._llm_fallback(ctx, profile, industry, country)
            seniority, function = taxonomy.normalize_title(profile.person_title)
            haystack = " ".join(profile.evidence_texts).lower()
            keywords = frozenset(
                k.keyword.strip().lower()
                for k in icp.keyword_signals
                if k.keyword.strip().lower() in haystack
            )
            attrs = Attributes(
                industry=industry,
                country=country,
                employee_count=profile.employee_count,
                seniority=seniority,
                function=function,
                domain=(profile.domain or "").lower() or None,
                title_text=profile.person_title,
                has_person=profile.has_person,
                keywords_found=keywords,
                evidence=profile.evidence,
            )
            icp_result = score_icp(icp, attrs)
            intent = score_intent(signals)
            excluded = any(i.criterion == "exclusion" for i in icp_result.breakdown)
            qualified = (not excluded) and icp_result.score >= icp.min_score_to_qualify
            step["output_summary"] = f"icp={icp_result.score} intent={intent.score} qualified={qualified}"
        return Qualification(
            icp_result, intent, qualified, why_fit(icp, icp_result), industry, country, sorted(keywords)
        )

    async def _llm_fallback(
        self, ctx: PipelineContext, profile: VerifiedProfile, industry: str | None, country: str | None
    ) -> tuple[str | None, str | None]:
        try:
            out = await self._llm.generate(
                ctx,
                task="normalize_attributes",
                system=prompt.SYSTEM,
                schema=NormalizeOut,
                user=prompt.user_prompt(
                    profile.industry_text if industry is None else None,
                    profile.location_text if country is None else None,
                    sorted(taxonomy.INDUSTRY_KEYS),
                ),
            )
        except BudgetExhausted:
            ctx.warn("budget_exhausted:max_llm_calls")
            return industry, country
        except EngineError as exc:
            if not exc.retryable and exc.code.value in ("QUOTA_EXCEEDED", "UNAVAILABLE"):
                raise
            ctx.warn(f"attribute_normalization_failed:{exc.code}")
            return industry, country
        # The model's answer is only accepted if it is a member of the closed taxonomy.
        if industry is None and out.industry in taxonomy.INDUSTRY_KEYS:
            industry = out.industry
        if country is None and out.country and re.fullmatch(r"[A-Z]{2}", out.country):
            country = out.country
        return industry, country
