"""Golden Research Results for the Next.js contract tests (validated there with zod).

uv run python scripts/export_fixtures.py          # rewrite ../../tests/fixtures/intelligence/*.json
uv run python scripts/export_fixtures.py --check  # fail if committed fixtures are stale
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from app.contracts.runs import RunRequest
from app.fake.pipeline import FakePipeline
from app.pipeline.context import PipelineContext

TARGET = Path(__file__).resolve().parents[3] / "tests" / "fixtures" / "intelligence"
DOMAINS = ["acme.example", "thin.example", "homonym.example", "none.example"]
ICP = {
    "industries": [{"value": "B2B SaaS", "weight": 25}],
    "employee_range": {"min": 50, "max": 500, "weight": 20},
    "geographies": [{"value": "India", "weight": 15}],
    "titles": [{"keywords": ["vp sales"], "weight": 25}],
    "keyword_signals": [{"keyword": "outbound", "weight": 15}],
    "min_score_to_qualify": 70,
}


def build() -> dict[str, str]:
    out: dict[str, str] = {}
    for domain in DOMAINS:
        req = RunRequest.model_validate(
            {
                "idempotency_key": f"fixture-{domain}",
                "task": "lead_research",
                "input": {
                    "company": {
                        "name": domain.split(".")[0].title(),
                        "domain": domain,
                        "location": "Bengaluru, India",
                    },
                    "lead": {"name": "Sarah Chen", "title": "VP Sales"},
                },
                "context": {
                    "icp": ICP,
                    "positioning": "We help outbound teams.",
                    "offer_keywords": ["outbound"],
                },
            }
        )
        result = asyncio.run(FakePipeline().execute(PipelineContext("fixture", req)))
        out[f"{domain}.json"] = json.dumps(result.model_dump(mode="json"), indent=2, sort_keys=True) + "\n"
    return out


def main() -> int:
    files = build()
    if "--check" in sys.argv:
        stale = [
            n for n, body in files.items() if not (TARGET / n).exists() or (TARGET / n).read_text() != body
        ]
        if stale:
            print(
                f"stale fixtures: {stale}. Run `uv run python scripts/export_fixtures.py`.", file=sys.stderr
            )
            return 1
        print("fixtures are up to date.")
        return 0
    TARGET.mkdir(parents=True, exist_ok=True)
    for name, body in files.items():
        (TARGET / name).write_text(body)
    print(f"wrote {len(files)} fixtures to {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
