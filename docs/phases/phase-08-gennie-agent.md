# Phase 8 — Gennie Agent (Command Center)

## Goal
Connect every capability behind one natural-language surface. The user states a goal; Gennie shows a plan with an estimate; the user approves; Gennie executes with live progress and ends with a **`READY` campaign awaiting approval** — never a sent one.

> "Find 50 SaaS founders in Bangalore and prepare an outbound campaign."

## Starting point
Phases 2–6 provide the domain functions (research, score, signals, generate, campaign, classify, draft). `agent_runs`/`agent_run_steps`/`jobs`/`usage_records` exist, and the Python Intelligence Engine is live (Phase 2). The Dashboard/Insight Board and Today's Brief are the current landing pages. **D-03** decides whether the engine has a people/company data provider yet.

## Scope

### WP8.1 — Tool registry (`lib/agent/tools/`)
Every tool: `{ name, description, inputSchema (zod), outputSchema (zod), estimateCost(input), requiresApproval: boolean, run(ctx, input) }`.

| Tool | Backed by | Notes |
|---|---|---|
| `search_companies`, `search_people` | Engine `discover` / `find_people` runs via `public_data` connectors (D-03) — Lead Agent → `IntelligenceClient` | absent from `/v1/capabilities` ⇒ returns `NOT_CONFIGURED`, plan omits discovery. Results land in `prospect_candidates`, not `leads` |
| `get_company`, `get_person` | domain services | read-only, workspace-scoped |
| `enrich_lead` | Engine `company_research` → apply **verified** fields to blanks only | never overwrites user data; provenance recorded |
| `research_company`, `find_buying_signals` | Phase 2 (engine runs, Research/Signal + Validator) | jobs; poll pattern |
| `score_lead` | Phase 2 (engine `POST /v1/score`, deterministic) | sync |
| `generate_email` | Phase 3 | validated drafts |
| `create_campaign`, `preview_campaign` | Phase 4 | creates `draft`/`ready` |
| `schedule_campaign` | Phase 4 | **`requiresApproval`** — agent can only *request* approval |
| `pause_campaign` | Phase 4 | |
| `classify_reply`, `draft_reply` | Phase 6 | |
| `send_reply` | — | **not registered** for agents; user-only |

Static check: `lib/agent/**` cannot import the DB client; a test asserts the registry has no tool that sends email. **Engine additions in this phase:** People mode of the Research Agent + `public_data` discovery connectors (licensed provider per D-03), `find_people`/`discover` run types, `/v1/capabilities` extended, candidate → lead conversion through the Phase 1 import service.

### WP8.2 — Planner
`POST /api/agent/plan` — LLM converts the prompt into a zod-validated `Plan { goal, steps[{ id, tool, args, dependsOn, estimatedRecords, estimatedCredits }], assumptions[], missingInputs[] }`. Rules: only registered tools; steps must be satisfiable (e.g. no discovery without provider → planner told the available tool set); ambiguity → `missingInputs` questions rather than guessing (e.g. "which mailbox?", "what ICP?" when workspace ICP empty); enforce caps (max leads per run, default 100). Plan is stored on `agent_runs.plan` with status `awaiting_approval`.

### WP8.3 — Orchestrator (deterministic state machine, not a free-running agent loop)
- Executes the approved plan step by step; **each step is a job**; per-lead fan-out via child jobs; run advances when dependencies complete. State persisted after every transition → survives restarts.
- **Pause / resume / cancel** honored between steps and between units of fan-out; cancel cascades to queued child jobs.
- **Adaptation is bounded:** on partial failure the orchestrator may retry (policy), skip failed leads (recorded), or stop — it may *not* invent new tool calls outside the approved plan. Material plan changes require re-approval.
- Guardrails enforced in code: workspace scope, per-run limits, campaign limits, DNC, no-send. Final step always `create_campaign(status=ready)` + approval request.
- Results: `agent_runs.output` = structured summary `{ leads_considered, researched, qualified (score ≥ threshold), emails_drafted, campaign_id, skipped[{lead, reason}] }` — **counts are computed from the DB, not narrated by the LLM.**

### WP8.4 — Command Center UI (replaces `/dashboard` home)
- Empty state per `01-product.md` (greeting, prompt bar, example prompts derived from workspace ICP, **Run with Gennie**).
- **Plan card** (numbered steps, assumptions, missing-input questions, estimated records + credits (or "credits coming in Phase 10"), **Run / Edit / Cancel**).
- **Execution view**: step list with ✓ ● ○ states, live counters from DB (SSE or short polling), **View results · Pause · Cancel**, per-step expandable log.
- **Results view**: prospects table with ICP score + *Why* summary + evidence chips, drafted emails, the `READY` campaign with **Review campaign** CTA. Failed/skipped leads listed with reasons.
- Below the prompt: Today's Brief essentials (needs-response threads, campaigns needing approval, failed sends, runs in progress) — real data only. Recent runs list.
- Keep Insight Board content only where backed by real data; otherwise remove (Analytics is Phase 9).

### WP8.5 — Runs & Jobs debug page (`/dashboard/settings/runs`, admin)
Per PLAN §42: run #, task, status, duration, credits/tokens, tools with ✓/✗, step logs, linked jobs, error details, re-run/cancel. Filters by status/user/date. Access: owner/admin.

### WP8.6 — Evals & safety tests for the agent
Scripted `FakeLlm` planners that attempt: unknown tool, arg injection across workspaces, sending email, exceeding limits, skipping approval, infinite fan-out → all must fail closed. Golden-path test: prompt → plan → approve → run (fakes) → `READY` campaign with N validated drafts.

## Out of scope
Autonomous send, self-modifying plans, background "always-on" agents, multi-turn chat memory beyond the current run, voice, marketplace of tools.

## Data changes
Extend `agent_runs` (`plan`, `parent_run_id`, `progress jsonb`), `agent_run_steps`; `0018_agent_full`. Job types `agent_run`, `agent_step`.

## Interfaces
`POST /api/agent/plan` · `POST /api/agent/run` (approve plan) · `GET /api/agent/:runId` (+ SSE `/events`) · `POST /api/agent/:runId/pause|resume|cancel`.

## Tests
See WP8.6, plus: run survives worker restart mid-step · cancel stops fan-out · budget/limit caps · every step recorded with tool/duration/status · output counts equal DB counts · isolation (run of workspace A cannot touch B's leads even with crafted args).

## Acceptance criteria
- [ ] One prompt → plan with estimates → approval → executes → ends with a `READY` campaign of validated, evidence-backed drafts
- [ ] Plan always shown and approved before any expensive step
- [ ] Live progress visible; **Pause / Cancel** work
- [ ] Gennie **cannot** send email, exceed limits, cross workspaces, or bypass approval (tests prove it)
- [ ] Summary numbers come from DB, not model text; skipped/failed leads are listed with reasons
- [ ] If no discovery provider is configured, the plan says so and works on existing leads instead of inventing prospects
- [ ] Every run is inspectable on the debug page with per-tool timing/credits/errors
- [ ] Run survives a worker restart without duplicating work
- [ ] `npm run verify` green

## Risks
Planner over-scoping/cost blowups → hard caps + estimates + approval. LLM flakiness in planning → constrained tool set, schema validation, deterministic fallback plan templates for the canonical prompts. Vague prompts → ask, don't guess.

## Exit
Tag `phase-8-complete` (Milestone M4). Mission: [`missions/phase-08-gennie-agent.md`](../missions/phase-08-gennie-agent.md). Specs: [`orchestrator`](../product-agents/orchestrator.md) and the per-agent files.
