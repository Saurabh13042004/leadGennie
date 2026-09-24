"""Contract invariants (docs/intelligence-engine/api-contract.md). Enforced on every result before it
leaves the engine and re-used by the tests on every fixture. Returns a list of violations (empty = ok)."""

from __future__ import annotations

from collections.abc import Iterable

from app.contracts.result import ResearchResult


def check_invariants(result: ResearchResult, fetched_urls: Iterable[str] | None = None) -> list[str]:
    problems: list[str] = []
    evidence = {e.id: e for e in result.evidence}
    if len(evidence) != len(result.evidence):
        problems.append("duplicate evidence ids")

    def refs(owner: str, ids: list[str]) -> None:
        for eid in ids:
            if eid not in evidence:
                problems.append(f"{owner}: evidence id {eid!r} does not resolve")

    for field in result.company.fields:
        refs(f"company.fields[{field.field}]", field.evidence_ids)
        if not field.evidence_ids:
            problems.append(f"company.fields[{field.field}]: field without evidence")
    for p in result.people:
        refs(f"people[{p.name}]", p.evidence_ids)
        if not p.evidence_ids:
            problems.append(f"people[{p.name}]: person without evidence")
    for s in result.signals:
        refs(f"signals[{s.id}]", s.evidence_ids)
        if not s.evidence_ids:
            problems.append(f"signals[{s.id}]: signal without evidence")
        if s.verified and not all(evidence[e].verification.verified for e in s.evidence_ids if e in evidence):
            problems.append(f"signals[{s.id}]: verified signal references unverified evidence")

    if fetched_urls is not None:
        fetched = set(fetched_urls)
        for e in result.evidence:
            if e.source_url not in fetched:
                problems.append(f"evidence[{e.id}]: source_url was not fetched by the engine")

    # Outreach narrative may only rest on verified evidence.
    refs("outreach", result.outreach.evidence_ids)
    for eid in result.outreach.evidence_ids:
        if eid in evidence and not evidence[eid].verification.verified:
            problems.append(f"outreach: references unverified evidence {eid!r}")

    # Scores may only rest on verified evidence.
    for item in result.icp.breakdown:
        refs(f"icp[{item.criterion}]", item.evidence_ids)
        for eid in item.evidence_ids:
            if eid in evidence and not evidence[eid].verification.verified and item.points > 0:
                problems.append(f"icp[{item.criterion}]: points awarded from unverified evidence {eid!r}")
    unverified_signal_ids = {s.id for s in result.signals if not s.verified}
    for it in result.intent.breakdown:
        if it.signal_id in unverified_signal_ids and it.points > 0:
            problems.append(f"intent: points awarded from unverified signal {it.signal_id!r}")
    for w in result.why_fit:
        refs(f"why_fit[{w.criterion}]", w.evidence_ids)
    return problems
