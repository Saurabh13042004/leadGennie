# Mission: Phase 2B — Lead Intelligence in the App (Next.js)

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-02-lead-intelligence.md` → *Phase 2B*. Also read `docs/intelligence-engine/api-contract.md` and `docs/product-agents/lead-agent.md`.
> Remember `AGENTS.md`: check `node_modules/next/dist/docs/` before writing Next.js code.

## Objective
From a lead detail page, a user can research a lead and see an explainable ICP score, buying signals with sources, and verified evidence for every claim. Research runs as background jobs that call the Python Intelligence Engine; the app persists results defensively and never falls back to guessing.

## Preconditions
- [ ] Phase 1 Done (companies, workspace ICP/positioning)
- [ ] **2A WP2A.1 merged** (contract + fake mode). You can develop the whole of 2B against the fake; final acceptance needs a real engine (staging or local `make dev`)
- [ ] D-02 resolved (paid quota) for real-engine runs · D-11/D-12 recorded

## Read first
`lib/ai/client.ts` + `lib/ai/providers/openai.ts`, `lib/actions/leads.ts`, `lib/activity.ts`, `lib/auth/workspace-context.ts`, Phase 0 `lib/api/*`, Phase 1 domain code, `docs/02-architecture.md` (jobs, tenancy, evidence pipeline), `docs/03-data-model.md`, `docs/intelligence-engine/{README,api-contract,scoring}.md`.

## Work packages
1. **WP2B.1 Foundations** — `lib/ai/client.ts` (+`FakeLlm`), `usage_records`, minimal `jobs` + `enqueue()` + `/api/jobs/tick`, minimal `agent_runs/agent_run_steps`, `lib/intelligence/{client,schemas,fake}.ts`, `npm run gen:intelligence`, env vars in `.env.example`. *Exit:* a job that calls the **fake** engine runs end-to-end and appears as an agent run.
2. **WP2B.2 Persistence** — migrations (`lead_research`, `signals`, `evidence`+verification, `field_provenance`, lead score columns, `prospect_candidates`); `persist.ts` in one transaction via domain services; invariant checks + **quarantine** path; trace/usage import. *Exit:* invariant-violating fixture writes nothing and produces a dead job with the engine run id.
3. **WP2B.3 Jobs** — `company_research`, `lead_research`, `lead_scoring` handlers (submit → poll-by-reschedule → validate → persist), idempotency keys, company-level reuse, per-run cap, progress. *Exit:* double delivery ⇒ one persistence; Next worker restart mid-run recovers; engine restart mid-run recovers via same-key resubmission (test with the fake's fault injection).
4. **WP2B.4 ICP editor** — taxonomy-valid form → `workspaces.icp`; sample scoring via `POST /v1/score`; ICP change enqueues `lead_scoring`.
5. **WP2B.5 UI** — lead detail page (all sections + honest states), leads table score/status columns, bulk **Research selected** with progress. Verified vs unverified separation. *Exit:* render the page for: researched lead, unresearched, no-evidence, partial, engine-down — in the running app.
6. **WP2B.6 Real-engine acceptance** — run against staging/local real engine: research 3 real leads; then 50 fake-engine leads for the restart tests; produce the evidence audit.

## Do NOT
Implement any research/scraping/scoring logic in TS (scoring is engine-only; no duplicate) · call an LLM from Next to "fill in" when the engine is down · give the engine DB access or workspace authority · generate emails (Phase 3) · enforce credits (record only) · build discovery (Phase 8) · trust engine output without zod + invariant checks · display unverified facts as facts.

## Verification
Vitest: persistence mapping, quarantine, job idempotency, engine-down/quota handling, isolation for all new tables/routes, contract test (zod vs engine fixtures) · manual: the five page states above · restart tests · `npm run verify:all`.

## STOP and ask if
The real engine's results routinely violate the invariants (fix in 2A, don't loosen the checks here) · persistence would need to trust an unverified field to make the UI work · the engine's latency makes bulk research impractical (propose queue/concurrency changes).

## Report
Format in `docs/missions/README.md`. Include an **evidence audit**: for 20 stored claims from real runs, show claim → evidence URL → verification method/confidence.
