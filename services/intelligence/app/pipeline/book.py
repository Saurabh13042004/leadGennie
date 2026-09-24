"""Turns validator verdicts into contract `Evidence` rows with stable, run-local ids."""

from __future__ import annotations

from datetime import UTC, datetime

from app.contracts.result import Evidence, Verification
from app.documents import DocumentSet
from app.evidence.models import ClaimVerdict, RefResult


class EvidenceBook:
    def __init__(self, docs: DocumentSet) -> None:
        self._docs = docs
        self._rows: dict[tuple[str, str, str], Evidence] = {}
        self._order: list[Evidence] = []

    def add(self, verdict: ClaimVerdict, ref: RefResult) -> str:
        """Record evidence for (claim, source). Verified only if BOTH the claim and this source passed."""
        doc = self._docs.get(ref.ref.source_url)
        assert doc is not None, "evidence may only be recorded for documents the engine fetched"
        key = (verdict.text, doc.url, ref.ref.snippet)
        if key in self._rows:
            return self._rows[key].id
        notes = list(verdict.notes) + [f"{c.name}: {c.note}" for c in ref.checks if not c.passed and c.note]
        ev = Evidence(
            id=f"ev_{len(self._order) + 1}",
            claim=verdict.text,
            source_url=doc.url,
            source_title=doc.title,
            source_type=doc.source_type,
            snippet=ref.ref.snippet,
            content_hash=doc.html_hash,
            captured_at=doc.fetched_at,
            verification=Verification(
                verified=bool(verdict.verified and ref.passed),
                confidence=verdict.confidence
                if (verdict.verified and ref.passed)
                else min(verdict.confidence, 0.69),
                method=list(verdict.methods) if verdict.methods else [c.name for c in ref.checks if c.passed],
                checked_at=datetime.now(UTC),
                notes=notes[:8],
            ),
        )
        self._rows[key] = ev
        self._order.append(ev)
        return ev.id

    def ids_for(self, verdict: ClaimVerdict) -> list[str]:
        """Evidence ids to attach to an item: passing refs if the claim verified, otherwise every *fetched* ref."""
        refs = verdict.passing_refs if verdict.verified else verdict.fetched_refs
        return list(dict.fromkeys(self.add(verdict, r) for r in refs))

    @property
    def rows(self) -> list[Evidence]:
        return list(self._order)

    def get(self, evidence_id: str) -> Evidence | None:
        return next((e for e in self._order if e.id == evidence_id), None)
