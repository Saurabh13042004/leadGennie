# Mission: Phase 8 — Gennie Agent (Command Center)

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-08-gennie-agent.md`. Agent specs: `product-agents/orchestrator.md` and siblings.

## Objective
One prompt → validated plan with estimates → user approval → durable execution with live progress → a `READY` campaign of evidence-backed drafts awaiting human approval. Gennie cannot send, cross workspaces, exceed limits, or skip approval.

## Preconditions
- [ ] Phases 2–6 Done (tools have real domain functions; engine live)
- [ ] **D-03 decided** (people/company data provider for the engine's `public_data` connector, or explicit "no discovery in V1" — then discovery tools are absent from `/v1/capabilities` and return `NOT_CONFIGURED`)
- [ ] Jobs runtime stable (Phase 5)

## Read first
`lib/ai/client.ts`, `lib/jobs/*`, Phase 2–6 domain services, `agent_runs` schema, `components/dashboard/InsightBoard.tsx`, `app/dashboard/page.tsx` and `brief/page.tsx` (to be replaced by the Command Center), `docs/product-agents/*`.

## Work packages
0. **WP8.0 Engine people/discovery (Python side, its own PR)** — People mode of the Research Agent, `public_data` connector for the chosen provider, `find_people`/`discover` run types, `capabilities` updates, evidence for provider-sourced data (`source_type='provider'`), tests with recorded fixtures. No email inference; no profile-site scraping. *Exit:* `verify:all` green with a fake provider; candidates returned with evidence.
1. **WP8.1 Tool registry** — `{name, inputSchema, outputSchema, estimateCost, requiresApproval, run(ctx,input)}` for every tool in the spec; lint rule forbidding DB-client imports in `lib/agent/**`; test asserting no email-sending tool exists.
2. **WP8.2 Planner** — `POST /api/agent/plan`, zod plan, `missingInputs`, caps, tool-availability awareness, stored as `awaiting_approval`. *Exit:* canonical prompts produce sane plans with fakes; adversarial prompts fail closed.
3. **WP8.3 Orchestrator** — deterministic state machine; steps as jobs; per-lead fan-out; partial-failure policy; pause/resume/cancel cascade; final `create_campaign(ready)` + approval request; summary counts computed from DB. *Exit:* restart-mid-run test.
4. **WP8.4 Command Center UI** — prompt bar, plan card, execution view (SSE or polling), results view, essentials strip (real data only), recent runs. Replace the home dashboard; delete Insight Board content not backed by real data.
5. **WP8.5 Runs/Jobs debug page** — admin-only, per-step timing/credits/errors, cancel/re-run.
6. **WP8.6 Safety evals** — scripted planners attempting: unknown tool, cross-workspace ids, sending, limit overrun, skipping approval, unbounded fan-out → all fail closed.

## Do NOT
Add autonomous sending · let the model narrate result counts · allow plan changes mid-run without re-approval · add always-on background agents · invent prospects when no provider exists.

## Verification
Golden path with fakes (prompt → `READY` campaign; counts == DB) · safety evals · restart/cancel/pause tests · isolation · manual: run it on a real workspace with 10 leads and inspect the debug page · `npm run verify`.

## STOP and ask if
Planner reliability is too low even with constrained tools (propose template plans) · discovery provider terms conflict with intended use · run costs exceed what a trial user could reasonably spend.

## Report
Format in `docs/missions/README.md`.
