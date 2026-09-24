@AGENTS.md

# Project docs loaded as context

These are imported into every Claude Code session so the rebuild plan, current phase and engineering rules are always in view. Everything else in `docs/` is read on demand — use the routing table in AGENTS.md ("The `docs/` folder is the source of truth").

@docs/README.md
@docs/04-engineering-rules.md

Before starting a phase, also read its spec and mission brief (`docs/phases/phase-NN-*.md`, `docs/missions/_preamble.md`, `docs/missions/phase-NN-*.md`). For anything involving research, evidence, scoring or Python, read `docs/intelligence-engine/README.md` first.
