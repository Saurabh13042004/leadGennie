# 06 — Quality & Testing

## Gates

`npm run verify` (added in Phase 0) = `tsc --noEmit` → `eslint` → `vitest run` → `next build`. It must pass before any phase is marked done and on every PR.

Phase-exit checklist (from PLAN "Quality Requirements") — evidence for each goes in the PR description:

1. Typecheck passes
2. Lint passes
3. Tests pass
4. Migrations apply on a **clean** database and on a copy of the current one
5. Authentication works (sign up, log in, protected routes redirect)
6. **Workspace isolation** test passes (two workspaces, no cross-reads/writes)
7. Primary user flow for the phase exercised end-to-end in a running app
8. No regressions in the smoke list below

## Two runtimes, one gate

From Phase 2A on, **`npm run verify:all`** = Next `verify` **+** engine `make verify` (ruff → mypy strict → pytest → contract). CI runs three jobs: `web`, `engine`, `contract` (OpenAPI drift; zod mirrors vs engine golden fixtures; engine vs Next example requests). Engine test strategy, adversarial validator suite and evals: [`intelligence-engine/development.md`](intelligence-engine/development.md). **Release-blocking engine metrics:** Evidence Validator **0 false-verified** on the adversarial corpus; 0 unsupported claims in stored agent outputs on the eval fixtures; injection fixtures inert; SSRF suite green.

## Test stack

- **Vitest** for unit + integration; `@testing-library/react` for component tests where logic lives in components.
- **Integration DB:** dedicated Neon branch via `DATABASE_URL_TEST` (decision D-08); harness migrates from empty, provides `createWorkspace()`/`createLead()` factories, truncates between files. Guard: abort if it equals `DATABASE_URL`.
- **Fakes, not network:** `FakeLlm` (scripted/structured outputs, can emit invalid JSON), `FakeMailProvider`, **`FakeIntelligenceClient`** (Next side; canned Research Results incl. invariant-violating, partial, engine-down, quota) and the engine's `ENGINE_FAKE_MODE`. CI never calls OpenAI/Resend/search/data providers or the public web.
- **E2E:** Playwright for the golden path from Phase 4 on (against a seeded test DB and fakes).
- **Static gates** (scripts in `scripts/checks/`): (a) no fake-metric patterns in authenticated UI, (b) `lib/agent/**` doesn't import the db client, (c) every `campaigns/leads/...` SQL `update/delete` contains `workspace_id`.

## What must be tested (by area)

| Area | Must-have tests |
|---|---|
| **Tenancy** | For every exported server action/route: caller in workspace B cannot read/update/delete workspace A's row by id; list endpoints never include A's rows |
| **Compliance** | DNC, unsubscribe, bounce, complaint, cooldown each block a send at enrollment *and* at send time; unsubscribe mid-sequence stops later steps |
| **Dispatch/jobs** | Double delivery of the same job sends once; crash mid-send (lease expiry) retries without duplicate; pause stops in-flight campaign; daily/total limits respected; provider 5xx retries with backoff, 4xx goes dead |
| **AI validation** | Invalid/partial model JSON never reaches the DB; retry-once path; quota error maps to `QUOTA_EXCEEDED` |
| **Evidence** | Claim without evidence is never included in generation input; generated email referencing unknown evidence id is rejected |
| **Engine integration** | Persistence maps a Research Result exactly; invariant-violating payload quarantined with zero writes; engine down/quota/partial handled; duplicate submit ⇒ one run; engine restart mid-run recovers via same-key resubmit; HMAC/skew rejection; engine cannot reach product tables |
| **Intelligence Engine** | SSRF/fetch guardrails; extraction goldens with `source_span`; **Evidence Validator adversarial suite**; scoring properties (deterministic, monotonic, unverified has zero effect); prompt-injection fixtures; budgets/idempotency/cancel |
| **Import** | 1,000-row CSV imports without timeout; duplicates detected; invalid emails flagged; re-import is idempotent |
| **Scoring** | Deterministic components (size/geo/role/industry match) unit-tested with table-driven cases |
| **Agent** | Tool registry rejects unknown tool/invalid input; run persists steps; cancel stops before next tool; run cannot call a tool outside workspace scope |
| **Inbox** | Reply matched to correct thread/lead (In-Reply-To/References + fallback); classification stored; suggested reply never auto-sent |
| **Credits** | Reservation + settle math; insufficient credits blocks before spend; ledger never negative |

## Smoke list (regression check every phase)

Sign up · Log in · Create/edit/delete lead · CSV import · Save a segment · Create + launch a campaign (dry) · Approve a mailbox · Unsubscribe link works · Resend webhook suppresses bounce · Forms public submission · API token auth on extension route.

## Non-functional targets (beta)

- Import of 1,000 leads: < 30 s end-to-end, no request timeouts (chunked/job-based).
- Command Center shows first progress within 1 s of "Run".
- Job worker: no send duplicated under 2 concurrent workers (property test).
- Zero unhandled promise rejections in a full golden-path run.
- Accessibility: keyboard-navigable Command Center, Leads table, Inbox; axe check on the 6 primary pages has no serious violations.

## V1 E2E gate (the release test)

Automated Playwright + manual demo script covering PLAN §47 in one run:

`sign up → workspace → connect email → import 50 leads → run Gennie → research → ICP score → signals → evidence → personalized emails → campaign → review → approve → schedule → send → (simulated) reply → classify → suggested reply → approve → send response`

Manual demo variant uses a real mailbox and real replies. **Do not tag beta until both pass twice in a row.**

## Observability minimums

Structured JSON logs on both runtimes (`lib/log.ts`; engine structlog) with `request_id`, `workspace_id`, `user_id`, `job_id`, `agent_run_id`, and the engine `run_id` so one research run is traceable end to end. Engine metrics: run duration p50/p95, fetch-block rate, LLM/search quota errors, budget-exhaustion rate, validator verified-rate. Error tracking hook (Sentry or equivalent) before beta. Internal Runs/Jobs debug page (Phase 8) shows the last 100 runs with steps, duration, credits, errors.
