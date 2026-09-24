# LeadGennie — Product Rebuild Docs

Source of truth for turning LeadGennie from an outbound dashboard into an **AI outbound operator**.
Derived from [`PLAN.md`](../PLAN.md) and grounded in an audit of the actual repo (see `00-current-state.md`).

> **The rule of the rebuild:** this is a rebuild *around* the existing codebase, not a rewrite.
> Extend what works, hide what's off-strategy, delete what's fake.

## How this folder is organised

| Path | What it is | Read when |
|---|---|---|
| [`00-current-state.md`](00-current-state.md) | Audited implementation map: what exists, reusable, broken, missing | Before anything else |
| [`01-product.md`](01-product.md) | Vision, positioning, ICP, core loop, V1 scope, UX principles | Making any product call |
| [`02-architecture.md`](02-architecture.md) | Target architecture, module boundaries, job runtime, tenancy | Designing any feature |
| [`03-data-model.md`](03-data-model.md) | Entities, mapping to existing tables, migration strategy | Touching the database |
| [`04-engineering-rules.md`](04-engineering-rules.md) | The rules every change must follow + repo conventions | Before writing code |
| [`05-decisions.md`](05-decisions.md) | Open decisions with recommendations — **needs your input** | Before Phases 2, 5, 6, 7 |
| [`06-quality-and-testing.md`](06-quality-and-testing.md) | Quality gates, test strategy, phase-exit checklist | End of every phase |
| [`intelligence-engine/`](intelligence-engine/README.md) | **Python service** ("LeadGennie Intelligence Engine"): architecture, API contract, sources, scoring, the five engine agents incl. the Evidence Validator, dev guide | Phase 2 onward; anything research/evidence/scoring |
| [`phases/`](phases/) | One spec per phase (0–11): scope, deliverables, acceptance criteria | Planning/reviewing a phase |
| [`product-agents/`](product-agents/) | Next.js-side agents (Orchestrator, Lead, Campaign, Inbox) | Phases 2B, 3, 6, 8 |
| [`missions/`](missions/) | Copy-paste briefs to hand to a coding agent, one per phase (Phase 2 is split 2A engine / 2B app) | Starting a phase |

## Reading order

1. `00-current-state` → `01-product` → `05-decisions` (resolve the blocking ones)
2. `02-architecture` + `intelligence-engine/README` + `03-data-model` + `04-engineering-rules`
3. `phases/README.md` for the roadmap, then the phase you're on
4. Hand the matching file in `missions/` to the coding agent

## The two runtimes

> **Next.js runs the business/product. Python investigates the world.**

- **Next.js app** — UI, workspaces/RBAC, leads, campaigns, email pipeline, inbox, approvals, credits, jobs, the Gennie orchestrator and its Lead/Campaign/Inbox agents. **Single writer of product data.**
- **LeadGennie Intelligence Engine (Python, `services/intelligence/`)** — source connectors, extraction, Research/Signal/Qualification/Outreach-Research agents, the **Evidence Validator**, deterministic ICP/intent scoring. Private, HMAC-authenticated, never writes product tables, never sends email. Decision **D-11**.

## Two kinds of "agent" in these docs (don't mix them up)

- **Product agents** — the AI features *inside* LeadGennie: Next-side (`product-agents/`: Orchestrator, Lead, Campaign, Inbox) and Python-side (`intelligence-engine/agents/`: Research, Signal, Qualification, Outreach Research, Evidence Validator).
- **Mission briefs** (`missions/`) — instructions for the *coding agent* (Claude Code etc.) that builds each phase.

## Status tracker

Update this table as phases land. A phase is only "Done" when every acceptance criterion in its spec passes (rule 25).

| Phase | Name | Status |
|---|---|---|
| 0 | Codebase stabilization | **Code complete; live DB migrated and smoke-tested over HTTP. Pending: real-browser click-through** (see `CHANGELOG-phases.md`) |
| 1 | Lead foundation | **Code complete; verified hermetically + over real Next server actions against a local Neon-protocol harness. Live DB backfilled. Pending: real-browser click-through, `npm run verify` blocked by an unrelated `services/` lint error** (see `CHANGELOG-phases.md`) |
| 2A | Intelligence Engine (Python) | Not started |
| 2B | Lead intelligence in the app | Not started |
| 3 | AI personalization | Not started |
| 4 | Campaign builder | Not started |
| 5 | Email execution engine | Not started |
| 6 | Inbox & reply intelligence | Not started |
| 7 | Chrome extension (capture) | Not started |
| 8 | Gennie agent | Not started |
| 9 | Analytics | Not started |
| 10 | Usage & credits | Not started |
| 11 | Billing & beta launch | Not started |

## Important: this is not the Next.js you know

`AGENTS.md` at the repo root states this project runs Next.js **16.2.6** with breaking changes. Before writing any Next.js code, read the relevant guide in `node_modules/next/dist/docs/`. Every mission brief repeats this instruction.
