"""Outreach Research Agent: why contact / why now / why this person / likely problem / recommended angle.

Sees VERIFIED evidence only. Every factual sentence must cite evidence ids; each is re-validated by the Evidence
Validator, and sentences that fail are REMOVED. Hypotheses are hedged and labelled; the angle may not contain
numbers/entities absent from the evidence, positioning or role. LLM unavailable => a purely templated fallback."""

from __future__ import annotations

import re

from pydantic import BaseModel, ConfigDict, Field

from app.contracts.result import Evidence, Outreach, Signal
from app.errors import EngineError
from app.evidence.matching import claim_consistency, company_aliases, normalize
from app.evidence.models import Claim, EvidenceRef
from app.evidence.validator import EvidenceValidator
from app.llm.client import LlmClient
from app.llm.prompts import outreach as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext

_HEDGE = re.compile(r"\b(may|might|could|possibly|potentially|likely)\b", re.I)
_MAX_SENTENCES = 3


class _Sentence(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(max_length=400)
    evidence_ids: list[str]


class OutreachDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    why_contact: list[_Sentence] = Field(default_factory=list)
    why_now: list[_Sentence] = Field(default_factory=list)
    why_person: list[_Sentence] = Field(default_factory=list)
    potential_problem: str | None = None
    recommended_angle: str | None = None
    angle_evidence_ids: list[str] = Field(default_factory=list)
    avoid: list[str] = Field(default_factory=list)


class OutreachAgent:
    def __init__(self, llm: LlmClient, validator: EvidenceValidator) -> None:
        self._llm, self._validator = llm, validator

    async def prepare(
        self,
        ctx: PipelineContext,
        *,
        company: str,
        domain: str | None,
        location: str | None,
        person_name: str | None,
        person_title: str | None,
        positioning: str,
        offer_keywords: list[str],
        verified: list[Evidence],
        signals: list[Signal],
    ) -> Outreach:
        usable = [e for e in verified if e.verification.verified]
        if not usable:
            return _fallback(company, signals, person_title, positioning, insufficient=True)
        async with ctx.step(
            "outreach",
            agent="outreach_research",
            tool="prepare",
            input_summary=f"{len(usable)} verified evidence",
        ) as step:
            block = "\n".join(f'[{e.id}] {e.claim} | quote: "{e.snippet}"' for e in usable[:25])
            who = f"{person_name}, {person_title}" if person_name and person_title else (person_name or "")
            try:
                draft = await self._llm.generate(
                    ctx,
                    task="outreach",
                    system=prompt.SYSTEM,
                    user=prompt.user_prompt(company, who, positioning, block),
                    schema=OutreachDraft,
                )
            except BudgetExhausted:
                ctx.warn("budget_exhausted:max_llm_calls")
                step["output_summary"] = "fallback (budget)"
                return _fallback(company, signals, person_title, positioning)
            except EngineError as exc:
                if not exc.retryable and exc.code.value in ("QUOTA_EXCEEDED", "UNAVAILABLE"):
                    raise
                ctx.warn(f"outreach_unavailable:{exc.code}")
                step["output_summary"] = "fallback (llm error)"
                return _fallback(company, signals, person_title, positioning)
            result = await self._finalize(
                ctx, draft, usable, company, domain, location, person_title, positioning
            )
            step["output_summary"] = (
                f"why_now={'y' if result.why_now else 'n'} insufficient={result.insufficient_evidence}"
            )
        return result

    async def _finalize(
        self,
        ctx: PipelineContext,
        draft: OutreachDraft,
        usable: list[Evidence],
        company: str,
        domain: str | None,
        location: str | None,
        person_title: str | None,
        positioning: str,
    ) -> Outreach:
        by_id = {e.id: e for e in usable}
        claims: list[Claim] = []
        index: dict[str, tuple[str, int]] = {}
        for section in ("why_contact", "why_now", "why_person"):
            for n, s in enumerate(getattr(draft, section)[:_MAX_SENTENCES]):
                ids = [i for i in s.evidence_ids if i in by_id]
                if not ids or not s.text.strip():
                    continue  # a sentence without valid verified evidence is never kept
                cid = f"outreach:{section}:{n}"
                index[cid] = (section, n)
                claims.append(
                    Claim(
                        id=cid,
                        text=s.text.strip(),
                        type="outreach",
                        refs=[EvidenceRef(by_id[i].source_url, by_id[i].snippet) for i in ids],
                        company_name=company,
                        company_domain=domain,
                        company_location=location,
                    )
                )
        verdicts = await self._validator.validate(ctx, claims) if claims else []
        keep: dict[str, list[str]] = {"why_contact": [], "why_now": [], "why_person": []}
        used_ids: list[str] = []
        dropped = 0
        for v in verdicts:
            section, _ = index[v.claim.id]
            if v.verified:
                keep[section].append(v.text)
                used_ids.extend(
                    i
                    for s_ in getattr(draft, section)[:_MAX_SENTENCES]
                    if s_.text.strip() == v.claim.text
                    for i in s_.evidence_ids
                    if i in by_id
                )
            else:
                dropped += 1
        if dropped:
            ctx.warn(f"outreach_sentences_removed:{dropped}")

        support = (
            " ".join(normalize(e.claim + " " + e.snippet) for e in usable)
            + " "
            + normalize(positioning + " " + (person_title or ""))
        )
        aliases = company_aliases(company, domain)
        problem = (draft.potential_problem or "").strip()
        if problem and (not _HEDGE.search(problem) or not claim_consistency(problem, support, aliases)[0]):
            problem = ""
        angle = (draft.recommended_angle or "").strip()
        angle_ids = [i for i in draft.angle_evidence_ids if i in by_id]
        if angle and not claim_consistency(angle, support, aliases)[0]:
            ctx.warn("outreach_angle_replaced: contained unsupported specifics")
            angle = ""
        insufficient = not keep["why_now"] and not any(keep.values())
        if not angle:
            angle = "Lead with a role-relevant, low-pressure question about how they handle this today."
            insufficient = insufficient or not keep["why_contact"]
        return Outreach(
            insufficient_evidence=insufficient,
            why_contact=" ".join(keep["why_contact"]),
            why_now=" ".join(keep["why_now"]) or "No recent verified triggers found.",
            why_person=" ".join(keep["why_person"]),
            potential_problem=problem,
            recommended_angle=angle,
            evidence_ids=list(dict.fromkeys([*used_ids, *angle_ids])),
            avoid=[a.strip() for a in draft.avoid[:5] if a.strip()],
        )


def _fallback(
    company: str,
    signals: list[Signal],
    person_title: str | None,
    positioning: str,
    insufficient: bool = False,
) -> Outreach:
    """Purely templated from VERIFIED signals — no model, so nothing to hallucinate."""
    verified = [s for s in signals if s.verified]
    why_now = (
        " ".join(f"{s.title}." for s in verified[:3]) if verified else "No recent verified triggers found."
    )
    ids = list(dict.fromkeys(i for s in verified[:3] for i in s.evidence_ids))
    return Outreach(
        insufficient_evidence=insufficient or not verified,
        why_contact="",
        why_now=why_now,
        why_person=f"Their role ({person_title}) is relevant to this topic." if person_title else "",
        potential_problem="",
        recommended_angle="Lead with a role-relevant, low-pressure question about how they handle this today.",
        evidence_ids=ids,
    )
