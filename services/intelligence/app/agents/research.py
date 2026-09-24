"""Research Agent (company mode): reconciles extracted facts into a profile and proposes the claims to verify.

Identity-like fields (industry, employee count, location, products) are chosen DETERMINISTICALLY by source
precedence; the LLM only writes short synthesized text (description / market / business model) and must cite
`fact_ids`. It never fetches and never writes — it returns candidate claims for the Evidence Validator."""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from pydantic import BaseModel, ConfigDict, Field

from app.documents import DocumentSet
from app.errors import EngineError
from app.evidence.models import Claim, EvidenceRef
from app.evidence.tiers import classify_source
from app.extraction.models import Extracted, Fact, PersonFact
from app.llm.client import LlmClient
from app.llm.prompts import research as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.scoring import taxonomy
from app.urls import registrable_domain

EMPLOYEE_BANDS = (
    (10, "1-10"),
    (50, "11-50"),
    (200, "51-200"),
    (500, "201-500"),
    (1000, "501-1000"),
    (5000, "1001-5000"),
)


def employee_band(n: int) -> str:
    for upper, label in EMPLOYEE_BANDS:
        if n <= upper:
            return label
    return "5000+"


class _Pick(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=400)
    fact_ids: list[str]


class SynthesisOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: _Pick | None = None
    market: _Pick | None = None
    business_model: _Pick | None = None


@dataclass
class ProfileCandidates:
    """Claims to verify, keyed so the pipeline can map verdicts back onto profile fields."""

    claims: list[Claim] = field(default_factory=list)
    people_claims: dict[str, PersonFact] = field(default_factory=dict)  # claim id -> person fact
    values: dict[str, str] = field(default_factory=dict)  # claim id -> raw fact value (identity-like fields)
    conflicts: list[str] = field(default_factory=list)


class ResearchAgent:
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
        *,
        synthesize: bool = True,
    ) -> ProfileCandidates:
        out = ProfileCandidates()
        facts_by_id = {f.id: f for f in extracted.facts}

        def ranked(facts: list[Fact]) -> list[Fact]:
            def key(f: Fact) -> tuple[float, float]:
                d = docs.get(f.doc_url)
                tier = classify_source(d, domain, registrable_domain)[1] if d else 0.0
                published = d.published_at.timestamp() if d and d.published_at else 0.0
                return (-tier, -published)

            return sorted(facts, key=key)

        def base(claim_id: str, text: str, facts: list[Fact], field_name: str) -> Claim:
            return Claim(
                id=claim_id,
                text=text,
                type="profile_field",
                refs=[EvidenceRef(f.doc_url, f.span) for f in facts],
                company_name=company,
                company_domain=domain,
                company_location=location,
            )

        for field_name, template in (
            ("industry", "{c} operates in the {v} industry"),
            ("employee_count", "{c} has {v} employees"),
            ("location", "{c} is based in {v}"),
            ("founded", "{c} was founded in {v}"),
        ):
            candidates = ranked([f for f in extracted.facts if f.field == field_name])
            if not candidates:
                continue
            best = candidates[0]
            distinct = {
                re.sub(r"\D", "", f.value) if field_name == "employee_count" else f.value.casefold()
                for f in candidates
            }
            if len(distinct) > 1:
                out.conflicts.append(f"conflicting_{field_name}")
            same = [f for f in candidates if f.value.casefold() == best.value.casefold()]
            out.claims.append(
                base(f"field:{field_name}", template.format(c=company, v=best.value), same, field_name)
            )
            out.values[f"field:{field_name}"] = best.value

        for i, f in enumerate(ranked([f for f in extracted.facts if f.field == "products"])[:8]):
            out.claims.append(base(f"field:product:{i}", f"{company} offers {f.value}", [f], "products"))
            out.values[f"field:product:{i}"] = f.value

        if synthesize:
            out.claims.extend(await self._synthesize(ctx, company, domain, location, extracted, facts_by_id))

        for i, p in enumerate(extracted.people[:12]):
            cid = f"person:{i}"
            text = f"{p.name} is {p.title} at {company}" if p.title else f"{p.name} works at {company}"
            out.people_claims[cid] = p
            out.claims.append(
                Claim(
                    id=cid,
                    text=text,
                    type="person",
                    refs=[EvidenceRef(p.doc_url, p.span)],
                    company_name=company,
                    company_domain=domain,
                    company_location=location,
                )
            )
        return out

    async def _synthesize(
        self,
        ctx: PipelineContext,
        company: str,
        domain: str | None,
        location: str | None,
        extracted: Extracted,
        facts_by_id: dict[str, Fact],
    ) -> list[Claim]:
        usable = [
            f
            for f in extracted.facts
            if f.field in ("description", "market", "business_model", "products", "customers", "industry")
        ]
        if len(usable) < 1:
            return []
        block = "\n".join(f'[{f.id}] ({f.field}) "{f.span}"' for f in usable[:40])
        try:
            draft = await self._llm.generate(
                ctx,
                task="research_synthesis",
                system=prompt.SYSTEM,
                user=prompt.user_prompt(company, block),
                schema=SynthesisOut,
            )
        except BudgetExhausted:
            ctx.warn("budget_exhausted:max_llm_calls")
            return []
        except EngineError as exc:
            if not exc.retryable and exc.code.value in ("QUOTA_EXCEEDED", "UNAVAILABLE"):
                raise
            ctx.warn(f"research_synthesis_failed:{exc.code}")
            return []
        claims: list[Claim] = []
        for name in ("description", "market", "business_model"):
            pick: _Pick | None = getattr(draft, name)
            if pick is None or not pick.text.strip():
                continue
            cited = [facts_by_id[i] for i in pick.fact_ids if i in facts_by_id]
            if not cited:  # a synthesized field with no valid fact ids is dropped, never trusted
                ctx.warn(f"dropped_uncited_{name}")
                continue
            claims.append(
                Claim(
                    id=f"field:{name}",
                    text=pick.text.strip(),
                    type="profile_field",
                    refs=[EvidenceRef(f.doc_url, f.span) for f in cited],
                    company_name=company,
                    company_domain=domain,
                    company_location=location,
                )
            )
        return claims


def normalize_location_country(location: str | None) -> str | None:
    return taxonomy.normalize_country(location)
