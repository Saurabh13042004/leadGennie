# Missions — Briefs for the Coding Agent

One brief per phase. Each is written to be handed to a coding agent (Claude Code or similar) **running inside this repo**, with file access. They reference the docs instead of duplicating them, so the docs stay the single source of truth.

## How to run a mission

1. Confirm the previous phase's status in [`../README.md`](../README.md) is **Done** and its blocking decisions in [`../05-decisions.md`](../05-decisions.md) are resolved.
2. Start a fresh agent session in the repo and paste:
   ```
   Read docs/missions/_preamble.md, then execute docs/missions/phase-NN-<name>.md.
   ```
3. The agent works in the order the brief lists, commits per work package, and ends with the **Report** (format below). Review the report against the phase's acceptance criteria before accepting.
4. If the agent hits a listed **STOP condition**, it must stop and ask instead of improvising.
5. After acceptance: update the status table, tag `phase-N-complete`, start the next mission in a *new* session (fresh context; the docs carry the state).

## Files

| File | Purpose |
|---|---|
| [`_preamble.md`](_preamble.md) | Standing rules + repo facts every mission inherits (read first, every time) |
| [`master-mission.md`](master-mission.md) | The whole-product mission statement (PLAN §50, tailored to this repo) — for orientation, not for one-shot execution |
| `phase-00-…` → `phase-11-…` | The per-phase briefs. **Phase 2 is two missions:** [`phase-02a-intelligence-engine`](phase-02a-intelligence-engine.md) (Python service) and [`phase-02b-lead-intelligence-app`](phase-02b-lead-intelligence-app.md) (Next.js). Start 2A after Phase 0; start 2B once 2A's contract + fake mode (WP2A.1) is merged |
| [`_template.md`](_template.md) | Skeleton for writing a new mission (e.g. a hotfix or a post-V1 phase) |

## Optional: parallel sub-agents inside a phase

A phase may be split across agents **only** along these seams, each in its own git worktree/branch, merged sequentially:

- **Engine (Python) ∥ App (Next.js)** across the contract — the natural seam for Phase 2 (2A ∥ 2B) and again for Phase 8 (people mode). Each side develops against the other's fake.
- *Schema & domain services* (one agent) → *UI* (another) once the service interfaces are merged.
- *Implementation* (one agent) → *tests/evals* (another, adversarial: tries to break the invariants) → *reviewer* (read-only: checks acceptance criteria and the rules table).

Never run two agents on the same files concurrently; sessions in this repo have collided before (re-read files before editing).

## Report format (every mission ends with this)

```
PHASE N REPORT
Summary: <2–4 sentences>
Acceptance criteria: <each criterion → PASS/FAIL + how verified (command output / URL / test name)>
Verification: typecheck ✓/✗ · lint ✓/✗ · tests (n passed) ✓/✗ · build ✓/✗ · migrations clean-DB ✓/✗ · isolation tests ✓/✗ · (from 2A) engine `make verify` ✓/✗ · contract ✓/✗
Deviations from spec: <what and why>
Existing-code reuse: <what was reused / refactored / added>
Open issues & follow-ups: <list>
Decisions needed: <list, if any>
```
No "done" without evidence for every criterion.
