# 04 — Engineering Rules

## The 25 rules (from PLAN §49) — with how each is enforced in *this* repo

| # | Rule | Enforcement here |
|---|---|---|
| 1 | Do not rewrite the application | Extend tables/components in place; PRs that delete working features need a written reason |
| 2 | Inspect before creating files | Mission briefs require an "existing code check" section in the PR/report before adding a file |
| 3 | Reuse existing components/models/utilities | See "Reusable" list in `00-current-state.md` |
| 4 | No duplicate functionality | e.g. no second approvals table, no second lead-status column, no second activity log |
| 5 | No mock data in authenticated production workflows | Grep gate: no `Math.random`/hash-derived numbers, hard-coded arrays of fake stats under `app/dashboard`/`components/**` (excluding tests/`demo/`) |
| 6 | Never fabricate company/prospect info | Engine **Evidence Validator** + Next persistence invariants (`02-architecture` → Evidence pipeline); generation gets verified evidence only |
| 7 | AI output uses structured schemas | zod schema per AI call in `lib/ai/schemas/` |
| 8 | Validate AI output before DB writes | `safeParse` in the single `lib/ai/client.ts` path; no raw `JSON.parse` of model text elsewhere |
| 9 | All workspace data tenant-isolated | `workspace_id` on every table; isolation test suite |
| 10 | Every mutation verifies workspace ownership | `requireRole()` + `where workspace_id = …` in every UPDATE/DELETE |
| 11 | Long-running work uses background jobs | Anything >~5 s or per-lead fan-out goes through `lib/jobs` |
| 12 | Jobs are idempotent | Natural-key uniqueness + `idempotency_key`; each handler has a double-delivery test |
| 13 | Email sending is rate-limited | Mailbox `daily_limit`, campaign `daily_limit`/`total_limit`, per-domain throttle, checked in `campaign_send` |
| 14 | Sending respects unsubscribe state | Unsub + DNC + bounce + complaint suppression checked at enrollment **and** immediately pre-send (extends `lib/compliance.ts`) |
| 15 | Agents can't run arbitrary DB mutations | `lib/agent/**` may not import `@/lib/db/client`; lint rule (`no-restricted-imports`) |
| 16 | Explicit tools for agent actions | Tool registry with zod I/O; unknown tool name = run failure |
| 17 | Important external actions need approval in V1 | Campaign launch → `approvals`; reply send → explicit user click; agent never sends |
| 18 | Every agent run is observable | `agent_runs` + `agent_run_steps` + structured logs; run debug page |
| 19 | Every expensive AI op is usage-tracked | `lib/ai/client.ts` writes `usage_records`; provider adapters too |
| 20 | No features outside the current phase | Mission briefs list explicit "Do NOT" items; reviewer rejects scope creep |
| 21 | TypeScript strictness | `strict: true` stays on; no `any` in new code without a comment; no `@ts-ignore` |
| 22 | Tests for critical business logic | See `06-quality-and-testing.md` — compliance, tenancy, dispatch, validation, scoring |
| 23 | Preserve working functionality | Hidden ≠ deleted. Smoke test list per phase |
| 24 | Run lint, typecheck, tests after each phase | `npm run verify` (added in Phase 0) |
| 25 | Phase isn't complete until acceptance passes | Status table in `docs/README.md` updated only with evidence attached |

## Repo conventions (learned from the codebase — match them)

- **Next.js 16.2.6 is not the Next you know.** Read `node_modules/next/dist/docs/` for the API you're about to use (routing, `proxy.ts` instead of middleware, caching semantics, async request APIs, server actions). Heed deprecation notices. Do not paste patterns from memory.
- **DB access:** `import { sql } from "@/lib/db/client"` tagged templates. Never string-concatenate SQL; for dynamic SQL use `sql.query(text, params)`. Neon HTTP driver → no session state, no interactive transactions; use `sql.transaction([...])`.
- **`"use server"` files may only export async functions.** Types/constants exported from action modules have broken the Turbopack build before — keep shared types/constants in plain `lib/*.ts` (see `lib/prompts-constants.ts`, `lib/approvals-core.ts`, `lib/forms-core.ts` for the pattern: `*-core.ts` = plain logic/types, `lib/actions/*.ts` = the server-action facade).
- **Tenant context:** `requireWorkspace()` / `requireRole("member"|"admin"|"owner")` at the top of every action. Extension routes use `extensionAuthFromRequest`. Session `user.id` is a string — convert with `Number()` and guard against `NaN` (a prior critical bug).
- **Audit trail:** significant mutations call `logActivity(...)` (`lib/activity.ts`).
- **Approvals:** anything owner/admin must sign off goes through `createApprovalRequest` / `decideApproval` — don't invent a parallel flow.
- **UI:** Tailwind 4, `cn()` from `lib/utils`, dark theme, lucide icons, existing `StatCard`, `DashboardShell`, modal patterns. Match density and naming of surrounding components. Client components stay under ~300 lines — split by responsibility (the 623-line `CampaignWizard` is the counter-example).
- **Verify rendering, not just data:** after changing a page, load the actual page (curl/browser) — a page has crashed in prod while its action's JSON looked fine.
- **Other sessions may be editing the same files.** Re-read a file immediately before editing it.

## Design principles — SOLID & Low-Level Design (all new code, TS and Python)

Summary is in `AGENTS.md`; this is the working detail. Rule of thumb: **use a pattern where there is real variation or a test seam; otherwise match the surrounding code's simplicity.** Patterns serve rules 3, 4 and 20 — they are not a license to add abstraction or scope.

| Principle | In this repo | Concrete examples |
|---|---|---|
| **S**ingle responsibility | Actions/routes = auth → validate → domain service → envelope. Domain services own rules. Repositories own SQL. Components own one piece of UI | Split `CampaignWizard` into step components + `useCampaignDraft`; move logic out of `lib/actions/leads.ts` into `lib/domain/leads` as touched |
| **O**pen/closed | Add an implementation to a registry instead of editing a `switch` | New agent tool, job handler, mail provider, engine connector, signal type, scoring criterion, prompt version |
| **L**iskov | Every implementation honors the whole contract incl. errors | `ResendProvider`/`GmailProvider`/`FakeMailProvider`; `FakeIntelligenceClient` vs real client; `ENGINE_FAKE_MODE` returns contract-valid results |
| **I**nterface segregation | Small role-specific interfaces | `Collector` ≠ `Agent`; `MailProvider.send` vs `syncReplies` split if a provider can't do both; `Tool` has `estimateCost` separate from `run` inputs |
| **D**ependency inversion | Logic takes dependencies as args (`ctx`, clients, clock, ids) | `lib/agent/**` calls domain services (no `sql`); domain never `new Resend()`; engine `llm/client.py` injected into agents |

| LLD strategy | Use for | Notes |
|---|---|---|
| Strategy | scoring criteria, providers, tone/seniority rules, retry/backoff policies | one interface, several implementations, chosen by config/context |
| Registry / Factory | agent tools, job handlers, connectors | unknown key ⇒ fail closed; registration is data, not `if` chains |
| Adapter | Resend, Gmail, Gemini, search/news APIs, the Intelligence Engine | external shapes never leak past the adapter |
| State machine | campaign, campaign_lead, job, agent run, approval, draft | explicit transition table + tests for illegal transitions |
| Command + idempotency | jobs, engine runs, sends | payload + idempotency key; handler = "make state X true" |
| Repository / query module | all SQL | in `lib/db/*` or domain repositories; workspace_id mandatory in signatures |
| Pipeline / template method | research run stages, send pipeline, import pipeline | ordered stages sharing a context object; each stage testable alone |
| Result / envelope errors | edges of every service | `AppError(code)` → `{ ok: true, data }` or `{ ok: false, error }`; never ad-hoc shapes |
| Parse, don't validate | boundaries | zod / pydantic into typed values, pass typed data inward |

Guardrails: prefer composition over inheritance; small pure functions; domain names over mechanism names; dependency direction UI → actions → domain → repositories/adapters (domain never imports `app/` or React); in Python `agents`/`scoring` never import `sources`. Code review checks: does this module have one reason to change? can I swap its dependency for a fake? did I add a branch that should have been a registry entry?

## Cross-service rules (Next.js ↔ Python Intelligence Engine)

Apply in addition to the 25 rules. Full design in [`intelligence-engine/`](intelligence-engine/README.md).

| # | Rule | Enforcement |
|---|---|---|
| X1 | **Single writer:** only Next.js writes product tables; the engine has no credentials to them | Engine DB role limited to `intel` schema; test connects with that role and asserts denial |
| X2 | **The engine never sends email or takes external actions** — it only reads the public web and returns data | No mail/SMTP deps in the engine; capability list contains no action tools |
| X3 | **No research/scraping/scoring logic in TypeScript**; no scoring logic duplicated in both languages | Code review + grep gate for scraping libs in `lib/`; scoring only in `services/intelligence/app/scoring` |
| X4 | **Contract-first:** pydantic models are the source of truth → OpenAPI → generated TS types; Next keeps zod mirrors; additive-only within `/v1` | CI `contract` job: OpenAPI drift check, zod vs engine fixtures, engine vs Next example requests |
| X5 | **Never trust the engine blindly:** Next re-validates responses (zod) and re-checks invariants; violating payloads are quarantined with no writes | Persistence tests with invariant-violating fixtures |
| X6 | **Engine down ≠ guess:** Next must not substitute LLM-generated research when the engine is unavailable | Test: engine-down path writes nothing and shows an explicit state |
| X7 | **Every engine call is idempotent** (deterministic idempotency key) and every run has hard budgets | Test: duplicate submit ⇒ one run; budget exhaustion ⇒ partial with warning |
| X8 | **Correlation ids everywhere:** `X-Request-Id`, `X-Agent-Run-Id`, `X-Job-Id`, `X-Workspace-Id` (logging only — never authorization) | Middleware on both sides; log-format test |
| X9 | **Engine metering:** engine returns `usage[]` and `trace[]`; Next writes `usage_records`/`agent_run_steps` | Persistence test |
| X10 | **Service auth:** bearer + HMAC over `timestamp.body`, ≤5 min skew, rotating secrets; private network only | Auth tests; deployment checklist |
| X11 | **`FAKE` modes on both sides** (`ENGINE_FAKE_MODE`, `FakeIntelligenceClient`) — no live network/LLM in default CI | CI config |
| X12 | **Max five engine agents** (Research, Signal, Qualification, Outreach Research, Evidence Validator); new agents need a decision record | `05-decisions.md` |

### Python conventions (engine)
Python 3.12, `uv` + lockfile, ruff, mypy strict, pytest (+respx, hypothesis), pydantic v2 for every boundary (requests, responses, LLM outputs), structlog JSON logs, no global mutable state, LLM calls only via `llm/client.py`, external calls only after `ctx.budget.spend()`, layering enforced by import-linter (`agents`/`scoring` may not import `sources`; `sources` may not import `agents`). Details: [`intelligence-engine/development.md`](intelligence-engine/development.md).

## Definition of Done (per change)

1. Acceptance criteria in the phase spec that this change touches are demonstrably met.
2. `npm run verify` passes (typecheck + lint + tests + build); once the engine exists (Phase 2A), `npm run verify:all` passes (adds engine `make verify` + contract checks). Touching the contract ⇒ regenerate types and update zod mirrors in the same change.
3. New tables have migrations, indexes, `workspace_id`, and an isolation test.
4. New AI calls have zod schemas, usage tracking, and a fake for tests.
5. New mutations have `requireRole`, workspace-scoped SQL, and `logActivity`.
6. No new fake/mock data; no console.log leftovers; docs updated (phase status, decisions).
7. The primary user flow for the phase was exercised end-to-end in a running app.

## Commit & PR conventions

Small commits per work package. Message format `phaseN: <what>` (e.g. `phase0: add versioned migrations runner`). One PR per phase or per work package group; the PR description lists acceptance criteria with pass/fail and how each was verified.
