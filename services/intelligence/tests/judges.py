"""Scripted entailment judges for tests (stand-ins for a sycophantic and an honest model)."""

from __future__ import annotations

import re
from typing import Any


def _ids(user: str) -> list[str]:
    return re.findall(r'<claim id="([^"]+)">', user)


def sycophant(_system: str, user: str) -> dict[str, Any]:
    return {
        "results": [{"id": i, "entails": "yes", "narrowed_claim": None, "reason": "ok"} for i in _ids(user)]
    }


def honest(_system: str, user: str) -> dict[str, Any]:
    out = []
    for block in re.findall(
        r'<claim id="([^"]+)">\n(?:COMPANY: .*?\n)?CLAIM: (.*?)\n(.*?)</claim>', user, flags=re.S
    ):
        cid, claim, body = block
        snippets = " ".join(re.findall(r"<snippet>(.*?)</snippet>", body, flags=re.S)).lower()
        negated = re.search(r"\b(did not|does not|never|no longer|not)\b", claim.lower()) and not re.search(
            r"\b(not|no)\b", snippets
        )
        reversed_rel = "reports to" in claim.lower() and "reports to" not in snippets
        verdict = "no" if (negated or reversed_rel) else "yes"
        out.append({"id": cid, "entails": verdict, "narrowed_claim": None, "reason": "scripted honest judge"})
    return {"results": out}
