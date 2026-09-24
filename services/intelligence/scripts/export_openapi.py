"""Write (or check) the committed OpenAPI document — the contract Next.js generates its types from.

uv run python scripts/export_openapi.py          # rewrite openapi.json
uv run python scripts/export_openapi.py --check  # fail if the committed file is stale (CI drift check)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from app.config import Settings
from app.main import create_app

TARGET = Path(__file__).resolve().parents[1] / "openapi.json"


def render() -> str:
    app = create_app(Settings(_env_file=None, engine_fake_mode=True))  # type: ignore[call-arg]
    return json.dumps(app.openapi(), indent=2, sort_keys=True) + "\n"


def main() -> int:
    fresh = render()
    if "--check" in sys.argv:
        if not TARGET.exists() or TARGET.read_text() != fresh:
            print("openapi.json is out of date. Run `make openapi` and commit the result.", file=sys.stderr)
            return 1
        print("openapi.json is up to date.")
        return 0
    TARGET.write_text(fresh)
    print(f"wrote {TARGET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
