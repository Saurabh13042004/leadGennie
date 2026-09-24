"""Human-readable "Why this lead?" checklist, TEMPLATED from the score breakdown — it cannot drift from the numbers.
Pure (no LLM, no IO): used by full runs and by `POST /v1/score`."""

from __future__ import annotations

from app.contracts.icp import Icp
from app.contracts.result import IcpResult, WhyFitItem


def why_fit(icp: Icp, result: IcpResult) -> list[WhyFitItem]:
    """Human-readable checklist TEMPLATED from the breakdown — it cannot drift from the numbers."""
    rng = icp.employee_range
    target = {
        "employee_range": f"target {rng.min if rng and rng.min is not None else '…'}–{rng.max if rng and rng.max is not None else '…'}"
        if rng
        else "",
        "industry": "target industries: " + ", ".join(i.value for i in icp.industries),
        "geography": "target regions: " + ", ".join(g.value for g in icp.geographies),
        "title": "target roles",
    }
    label = {
        "employee_range": "Company size",
        "industry": "Industry",
        "geography": "Location",
        "title": "Decision-maker role",
    }
    out: list[WhyFitItem] = []
    for item in result.breakdown:
        if item.criterion == "exclusion":
            out.append(
                WhyFitItem(
                    criterion="exclusion", status="not_met", text=item.value_found or "Excluded by ICP"
                )
            )
            continue
        name = label.get(
            item.criterion,
            item.criterion.replace("keyword:", "Mentions “")
            + ("”" if item.criterion.startswith("keyword:") else ""),
        )
        detail = {
            "met": "matches",
            "partial": "partly matches",
            "not_met": "does not match",
            "unknown": "unknown",
        }[item.status]
        found = f" — {item.value_found}" if item.value_found else ""
        if item.criterion.startswith("keyword:") and item.status == "unknown":
            out.append(
                WhyFitItem(
                    criterion=item.criterion,
                    status="unknown",
                    text=f"“{item.criterion.removeprefix('keyword:')}” not found in the pages we read",
                    evidence_ids=[],
                )
            )
            continue
        tgt = (
            f" ({target[item.criterion]})"
            if item.criterion in target and target[item.criterion] and item.status != "unknown"
            else ""
        )
        out.append(
            WhyFitItem(
                criterion=item.criterion,
                status=item.status,
                text=f"{name} {detail}{found}{tgt}",
                evidence_ids=item.evidence_ids,
            )
        )
    return out
