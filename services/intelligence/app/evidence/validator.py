"""The Evidence Validator — the product's USP in code. Given claims and the run's captured documents, decide
for each claim whether it is VERIFIED. Deterministic checks first; one batched LLM entailment step; fails
closed. Nothing unverified may be presented as fact downstream (scoring, outreach narrative, generated copy)."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.config import Settings
from app.contracts.common import SignalType
from app.documents import DocumentSet, RawDocument
from app.errors import EngineError
from app.evidence import confidence as conf
from app.evidence.matching import (
    claim_consistency,
    company_aliases,
    context_window,
    find_span,
    normalize,
)
from app.evidence.models import CheckResult, Claim, ClaimVerdict, EvidenceRef, RefResult
from app.evidence.recency import recency_factor
from app.evidence.tiers import classify_source
from app.injection import scan_for_injection
from app.llm.client import LlmClient
from app.llm.prompts import entailment as prompt
from app.pipeline.context import BudgetExhausted, PipelineContext
from app.scoring import taxonomy
from app.telemetry.logging import get_logger
from app.urls import registrable_domain

log = get_logger(__name__)
ENTAILMENT_BATCH = 10
_LIVE_TYPES = ("jobs_board", "careers")  # live listings: "captured now" is their date


class _Item(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id: str
    entails: Literal["yes", "partial", "no"]
    narrowed_claim: str | None = None
    reason: str = ""


class EntailmentOut(BaseModel):
    model_config = ConfigDict(extra="forbid")
    results: list[_Item]


def _domain_mentioned(doc: RawDocument, domain: str) -> bool:
    d = domain.lower().removeprefix("www.")
    return d in doc.text.lower() or any(
        registrable_domain(link) == registrable_domain(d) for link in doc.links
    )


_HQ_PATTERNS = (
    re.compile(
        r"(?:based in|based out of|headquartered in|headquarters in|hq in)\s+((?:[a-z.'-]+(?: [a-z.'-]+){0,2})(?:,\s*[a-z.'-]+(?: [a-z.'-]+){0,2}){0,2})"
    ),
    re.compile(r"\b([a-z][a-z.'-]{2,})-based\b"),
    re.compile(r"\(([a-z][a-z .'-]+(?:,\s*[a-z][a-z .'-]+)?)\)"),
)


def _hq_countries(window: str) -> set[str]:
    """Countries the page says the company is BASED in ("based in Boston, USA", "Boston-based", "(Boston, USA)").
    Expansion news naming another country ("opened an office in Austin") deliberately does NOT count."""
    found: set[str] = set()
    for rx in _HQ_PATTERNS:
        for m in rx.finditer(window):
            if (c := taxonomy.normalize_country(m.group(1))) is not None:
                found.add(c)
    return found


def _location_conflict(window: str, company_location: str | None) -> str | None:
    """A third-party page that places the company's headquarters in a different country than the known one
    is (very likely) about a different company with the same name."""
    if not company_location:
        return None
    ours = taxonomy.normalize_country(company_location)
    if not ours:
        return None
    theirs = _hq_countries(window)
    if theirs and ours not in theirs:
        return f"page places the company's headquarters in {sorted(theirs)} (expected {ours})"
    return None


class EvidenceValidator:
    def __init__(self, docs: DocumentSet, llm: LlmClient, settings: Settings) -> None:
        self._docs, self._llm, self._threshold = docs, llm, settings.verify_threshold
        self._model = settings.entailment_model

    async def validate(self, ctx: PipelineContext, claims: list[Claim]) -> list[ClaimVerdict]:
        async with ctx.step(
            "validating", agent="evidence_validator", tool="validate", input_summary=f"{len(claims)} claims"
        ) as step:
            verdicts = [self._deterministic(c) for c in claims]
            pending = [v for v in verdicts if self._needs_entailment(v)]
            await self._entail(ctx, pending)
            for v in verdicts:
                self._finalize(v)
            step["output_summary"] = f"verified={sum(v.verified for v in verdicts)}/{len(verdicts)}"
        return verdicts

    # -- deterministic checks (1-3, consistency) -------------------------------------------------------

    def _deterministic(self, claim: Claim) -> ClaimVerdict:
        v = ClaimVerdict(claim=claim, verified=False, confidence=0.0)
        aliases = company_aliases(claim.company_name, claim.company_domain)
        for ref in claim.refs:
            v.refs.append(self._check_ref(ref, claim, aliases))
        passing = v.passing_refs
        if not passing:
            v.notes.append("no source passed the hard checks")
            return v
        joined = " ".join(normalize(r.ref.snippet) for r in passing)
        ok, problems = claim_consistency(claim.text, joined, aliases)
        v.checks.append(CheckResult("claim_consistency", ok, True, "; ".join(problems)))
        if not ok:
            v.notes.extend(problems)
        return v

    def _check_ref(self, ref: EvidenceRef, claim: Claim, aliases: set[str]) -> RefResult:
        r = RefResult(ref=ref, fetched=False, passed=False)
        doc = self._docs.get(ref.source_url)
        r.checks.append(
            CheckResult(
                "url_fetched",
                doc is not None,
                True,
                "" if doc else "source URL was not fetched by the engine (never trust model-supplied URLs)",
            )
        )
        if doc is None:
            return r
        r.fetched, r.doc_url = True, doc.url
        found, how = find_span(ref.snippet, doc.text)
        r.checks.append(
            CheckResult(
                "snippet_present", found, True, how if found else "snippet not found in captured text"
            )
        )
        if not found:
            return r
        tier, weight = classify_source(doc, claim.company_domain, registrable_domain)
        r.tier, r.tier_weight = tier, weight
        first_party = tier == "first_party"
        entity_ok, entity_note = first_party, "first-party domain" if first_party else ""
        linked_from = str(doc.metadata.get("linked_from") or "")
        # A board proves "this is the company's board" only if it was linked from THAT company's own site.
        board_is_theirs = bool(
            claim.company_domain
            and linked_from
            and registrable_domain(linked_from) == registrable_domain(claim.company_domain)
        )
        if not first_party and doc.source_type.value == "jobs_board" and board_is_theirs:
            entity_ok, entity_note = (
                True,
                f"job board linked from the company's own site ({doc.metadata['linked_from']})",
            )
        elif not first_party:
            title_norm = normalize(doc.title or "")
            window = context_window(ref.snippet, doc.text)
            named = any(a in title_norm or a in window for a in aliases)
            linked = bool(claim.company_domain) and _domain_mentioned(doc, claim.company_domain or "")
            conflict = None if linked else _location_conflict(window, claim.company_location)
            entity_ok = (named or linked) and conflict is None
            entity_note = conflict or (
                "company named near the snippet"
                if named
                else "company domain referenced"
                if linked
                else "page does not mention the company near the snippet"
            )
        r.checks.append(CheckResult("entity_match", entity_ok, True, entity_note))
        inj = bool(doc.injection_flagged and scan_for_injection(ref.snippet))
        r.checks.append(
            CheckResult(
                "snippet_not_instruction", not inj, True, "snippet looks like an instruction" if inj else ""
            )
        )
        r.passed = entity_ok and not inj
        return r

    @staticmethod
    def _needs_entailment(v: ClaimVerdict) -> bool:
        return bool(v.passing_refs) and all(c.passed for c in v.checks if c.hard)

    # -- LLM entailment (one batched call per ENTAILMENT_BATCH claims; fails closed) ---------------------

    async def _entail(self, ctx: PipelineContext, pending: list[ClaimVerdict]) -> None:
        for start in range(0, len(pending), ENTAILMENT_BATCH):
            batch = pending[start : start + ENTAILMENT_BATCH]
            blocks = "\n\n".join(
                f'<claim id="{v.claim.id}">\nCOMPANY: {v.claim.company_name}'
                + (f" ({v.claim.company_domain})" if v.claim.company_domain else "")
                + (f", based in {v.claim.company_location}" if v.claim.company_location else "")
                + f"\nCLAIM: {v.claim.text}\n"
                + "\n".join(f"<snippet>{r.ref.snippet}</snippet>" for r in v.passing_refs)
                + "\n</claim>"
                for v in batch
            )
            try:
                out = await self._llm.generate(
                    ctx,
                    task="entailment",
                    system=prompt.SYSTEM,
                    user=prompt.user_prompt(blocks),
                    schema=EntailmentOut,
                    model=self._model,
                )
            except (BudgetExhausted, EngineError) as exc:
                reason = "budget" if isinstance(exc, BudgetExhausted) else exc.code.value.lower()
                for v in batch:
                    v.checks.append(
                        CheckResult("entailment", False, True, f"entailment_unavailable ({reason})")
                    )
                    v.notes.append("entailment_unavailable")
                if (
                    isinstance(exc, EngineError)
                    and not exc.retryable
                    and exc.code.value in ("QUOTA_EXCEEDED",)
                ):
                    raise
                continue
            by_id = {i.id: i for i in out.results}
            for v in batch:
                item = by_id.get(v.claim.id)
                if item is None:  # the model skipped a claim: fail closed
                    v.checks.append(CheckResult("entailment", False, True, "no verdict returned"))
                    continue
                v.checks.append(
                    CheckResult(
                        "entailment", item.entails != "no", True, f"{item.entails}: {item.reason}"[:300]
                    )
                )
                v.methods.append(f"entailment:{item.entails}")
                if item.entails == "partial":
                    self._accept_narrowed(v, item.narrowed_claim)

    @staticmethod
    def _accept_narrowed(v: ClaimVerdict, narrowed: str | None) -> None:
        """A narrowed claim must itself pass the deterministic consistency gate; otherwise it's unverified."""
        if not narrowed:
            v.checks.append(CheckResult("narrowed_claim", False, True, "partial without a narrowed claim"))
            return
        aliases = company_aliases(v.claim.company_name, v.claim.company_domain)
        joined = " ".join(normalize(r.ref.snippet) for r in v.passing_refs)
        ok, problems = claim_consistency(narrowed, joined, aliases)
        v.checks.append(CheckResult("narrowed_claim", ok, True, "; ".join(problems)))
        if ok:
            v.narrowed_claim = narrowed

    # -- recency, tier, corroboration, confidence ------------------------------------------------------

    def _finalize(self, v: ClaimVerdict) -> None:
        hard_ok = bool(v.passing_refs) and all(c.passed for c in v.checks if c.hard)
        if not hard_ok:
            v.verified, v.confidence = False, 0.0
            return
        best = max(v.passing_refs, key=lambda r: r.tier_weight)
        entails = next((m.split(":")[1] for m in v.methods if m.startswith("entailment:")), "no")
        source_date = v.claim.source_date or self._doc_date(v)
        first_party = best.tier == "first_party"
        factor, note, expired = recency_factor(v.claim.signal_type, source_date, first_party)
        v.checks.append(CheckResult("recency", not expired, False, note or "within window"))
        if note:
            v.notes.append(note)
        independent = len({registrable_domain(r.doc_url or r.ref.source_url) for r in v.passing_refs})
        v.confidence = 0.0 if expired else conf.confidence(best.tier_weight, entails, factor, independent)
        v.verified = (not expired) and v.confidence >= self._threshold
        v.methods = [
            "url_fetched",
            "snippet_present",
            "entity_match",
            "claim_consistency",
            *v.methods,
            "recency",
            f"tier:{best.tier}",
            f"sources:{independent}",
        ]
        if not v.verified and not expired:
            v.notes.append(f"confidence {v.confidence} below threshold {self._threshold}")

    def _doc_date(self, v: ClaimVerdict) -> datetime | None:
        dates: list[datetime] = []
        for r in v.passing_refs:
            doc = self._docs.get(r.ref.source_url)
            if doc is None:
                continue
            if doc.published_at:
                dates.append(doc.published_at)
            elif doc.source_type.value in _LIVE_TYPES:
                dates.append(doc.fetched_at.astimezone(UTC))
        return max(dates) if dates else None


def stated_date(doc: RawDocument) -> datetime | None:
    return doc.published_at


__all__ = ["EntailmentOut", "EvidenceValidator", "SignalType"]
