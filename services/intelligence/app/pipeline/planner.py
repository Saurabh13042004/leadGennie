"""Deterministic search planner: predictable cost and baseline coverage. (LLM-proposed extra queries are a
later addition; the template set is what guarantees coverage.)"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlannedQuery:
    text: str
    kind: str  # funding | expansion | hiring | leadership | offer | general


def plan_queries(
    company: str, domain: str | None, offer_keywords: list[str], role_keywords: list[str]
) -> list[PlannedQuery]:
    name = company.strip().replace('"', "")
    q = [
        PlannedQuery(f'"{name}" funding OR raised OR "Series A" OR "Series B" OR "Series C"', "funding"),
        PlannedQuery(
            f'"{name}" expansion OR "new office" OR "expands into" OR launches OR announces', "expansion"
        ),
        PlannedQuery(
            f'"{name}" hiring {" OR ".join(role_keywords[:3])}'.strip()
            if role_keywords
            else f'"{name}" hiring',
            "hiring",
        ),
        PlannedQuery(f'"{name}" appoints OR "joins as" OR "new CEO" OR "new VP"', "leadership"),
    ]
    for kw in offer_keywords[:2]:
        q.append(PlannedQuery(f'"{name}" {kw}', "offer"))
    if domain:
        q.append(PlannedQuery(f'"{name}" "{domain}"', "general"))
    seen: set[str] = set()
    out: list[PlannedQuery] = []
    for item in q:
        if item.text not in seen:
            seen.add(item.text)
            out.append(item)
    return out


def news_queries(planned: list[PlannedQuery]) -> list[str]:
    return [p.text for p in planned if p.kind in ("funding", "expansion", "leadership")]


def web_queries(planned: list[PlannedQuery]) -> list[str]:
    return [p.text for p in planned if p.kind in ("hiring", "offer", "general")]
