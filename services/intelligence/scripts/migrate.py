"""Apply `migrations/*.sql` to the `intel` schema. Run with a privileged role; the runtime role only needs
access to the `intel` schema."""

from __future__ import annotations

import asyncio
import os
import sys

from app.store.postgres import apply_migrations


async def main() -> int:
    dsn = os.environ.get("INTEL_DATABASE_URL", "")
    if not dsn:
        print("INTEL_DATABASE_URL is not set", file=sys.stderr)
        return 1
    applied = await apply_migrations(dsn)
    print("applied:", ", ".join(applied) if applied else "nothing (already up to date)")
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
