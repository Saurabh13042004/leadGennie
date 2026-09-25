# Phase 0 — Codebase Stabilization

## Goal
Make the existing project safe to extend: honest, tested, consistently structured, deployable from a clean database. **No new product features.**

## Starting point (see `00-current-state.md`)
Typecheck passes. No tests, no lint/build baseline recorded, ad-hoc migration runner, fake metrics on landing + wizard, 25-item nav with 9 stub pages, inconsistent error handling, `console.*` logging, one dangerous test script.

## Scope

### WP0.1 — Baseline & tooling
- Record baseline: `npm run lint`, `next build`, app boots, login works. Fix what's red (only what's red).
- Add `npm run verify` = typecheck + lint + test + build. Add `npm run typecheck`, `npm run test`.
- Add Vitest + config; `DATABASE_URL_TEST` guard (decision D-08). Add Neon test-branch instructions to `docs/deployment.md`.
- Create `docs/deployment.md` (topology, env vars table, cron/worker trigger, webhook URLs) — resolves D-10. Leave a placeholder section for the **Python Intelligence Engine** (host, private networking, `INTELLIGENCE_URL`, signing secret — filled in during Phase 2A per D-12), and reserve the monorepo path `services/intelligence/` + a language-aware `verify:all` hook.
- Create `.env.example` with every variable actually read by code (grep `process.env`), no values.

### WP0.2 — Versioned migrations
- `db/migrations/0001_baseline.sql` (= current `lib/db/schema.sql`), `schema_migrations` table, new runner `scripts/migrate.mjs` (ordered, checksummed, multi-statement/`DO $$` safe, idempotent, `--status`).
- Fold `scripts/migrate-workspaces.mjs` behavior into a numbered migration/backfill or mark it done and remove.
- Seed script (`scripts/seed.mjs`) works on a clean DB and creates a **demo workspace** explicitly flagged `is_demo` (used by tests/E2E; never mixed with real data).
- CI-style check: empty DB → migrate → seed → tests.

### WP0.3 — Response/error/validation/logging layers
- `lib/api/` — `ok()`, `fail()`, `AppError`, `toResponse()`, `parseJson(schema)`; add `zod`.
- `lib/log.ts` — structured JSON logger (`level, msg, request_id, workspace_id, user_id, …`).
- Convert the **API routes** (`register`, `book-demo`, `unsubscribe`, `forms/*`, `extension/*`, `cron/*`, `webhooks/resend`, `integrations/*`) to the envelope + zod validation. Server actions convert opportunistically (only the ones touched in this phase).
- Global error boundaries for `/dashboard` (`error.tsx`, `not-found.tsx`) — a crashing page must not show a stack.

### WP0.4 — Tenancy audit + isolation tests
- Audit every SQL statement on workspace tables (`grep -rn "from leads\|update leads\|delete from" lib app`) for `workspace_id` filters; fix any that key on `id` alone or `owner_email`.
- **Stop writing `owner_email`** (make nullable in a migration); keep column for history.
- Isolation test suite (two workspaces) covering leads, segments, campaigns, approvals, deals, tasks, prompts, domains, mailboxes, forms, workflows, DNC, activities, api tokens.
- Hash API tokens at rest (`api_tokens.token` → store sha256, show once) with a migration path for existing tokens.

### WP0.5 — Remove fake & decorative content
- `CampaignWizard`: delete `hashRate()`/predicted reply rate; remove the four decorative personalization options (news, tone, localize, A/B) — they return in Phases 2/3 only when real.
- Landing: remove every fabricated metric (`Hero.tsx` activity feed/bars/campaign table, `Features.tsx` "+31% Avg Reply Rate", `AiTerminal.tsx` "92%", any testimonial-like numbers) → replace with neutral copy or a component wrapped in an explicit **"Demo data"** label. Remove `SocialProof` third-party logo marquee (implies endorsement) and the hardcoded logo.dev key fallback.
- Grep gate script `scripts/checks/no-fake-metrics.mjs` (see `06-quality`).
- Fix `nav-config.ts` "LeadGennie Solutions Sales Agent" → workspace name.

### WP0.6 — Navigation & structure
- Nav → six items (Command Center [temporarily the existing dashboard], Leads, Campaigns, Inbox, Analytics, Settings). Settings hub links: Workspace/Team, Mailboxes & Domains, Do Not Contact, AI Prompts, Integrations, API Credentials, Approvals.
- Legacy modules (Deals, Tasks, Accounts, Agentic Flows, CRM Sync, Meetings, Knowledge, Webhooks, Notifications, Help, Signals, Usage stubs) hidden behind `NEXT_PUBLIC_SHOW_LEGACY_MODULES` (default off). Routes remain; stub pages that are pure `ComingSoon` are removed from nav *and* return 404 when flag off.
- Forms + Unmatched Inbox move under Leads ("Inbound"); the Inbox nav item temporarily shows an honest empty state ("Replies will appear here — coming in Phase 6").

### WP0.7 — Component/dead-code hygiene
- Split `CampaignWizard.tsx` (623 lines) into step components + a `useCampaignDraft` hook (behavior unchanged).
- Remove unused exports/files found by `ts-prune`/`knip` (report first, delete only confirmed dead code).
- Replace `scripts/test-campaign-compliance.mjs` with a Vitest integration test using the test DB + factories.

### WP0.8 — Baseline tests (critical logic only)
Compliance (DNC + cooldown), dispatch precheck, lead import idempotency, approvals state machine, workspace isolation, extension token auth, unsubscribe token, encryption round-trip.

## Out of scope
New features, schema for later phases, UI redesign beyond removal/nav, rewriting server actions wholesale.

## Data changes
`0001_baseline`, `0002_schema_migrations_and_owner_email_nullable`, `0003_api_token_hash`, `is_demo` on workspaces.

## Acceptance criteria
- [ ] Existing auth works: sign up → login → protected redirect → logout
- [ ] Existing dashboard/leads/campaigns/deliverability still work (smoke list)
- [ ] Empty database → `npm run db:migrate` → seed → app boots; re-running migrate is a no-op
- [ ] No fake metrics in authenticated UI **or** landing page (grep gate passes; manual review of `/`)
- [ ] Wizard shows no invented reply-rate and no non-functional options
- [ ] API errors are structured envelopes with codes; no stack traces reach the client
- [ ] Every workspace-table query is workspace-scoped; isolation tests pass; no code writes `owner_email`
- [ ] API tokens stored hashed
- [ ] Nav has exactly six primary items; legacy hidden behind flag; no reachable `ComingSoon` page
- [ ] `npm run verify` passes (typecheck, lint, tests, build)
- [ ] `docs/deployment.md`, `.env.example`, `docs/CHANGELOG-phases.md` exist

## Risks
- Hiding modules may break bookmarked deep links → keep routes (flagged) and redirect stubs to `/dashboard`.
- Token hashing breaks existing extension installs → grace window: accept legacy plaintext once, re-issue hashed token, log.
- Lint may reveal a long backlog → fix errors, downgrade noisy rules temporarily with a tracked TODO list, don't blanket-disable.

## Exit
Status table updated; tag `phase-0-complete`. Mission brief: [`missions/phase-00-stabilization.md`](../missions/phase-00-stabilization.md).
