# 00 — Current State (audited implementation map)

Audit date: 2026-09-24, against `main` @ `89c93dd`. Typecheck (`tsc --noEmit`) passed clean; `next build` passed; ESLint had 38 errors (baseline recorded in `CHANGELOG-phases.md`).

> **Updated during Phase 0 (2026-09-24):** rows below marked ✅ describe the repo *after* Phase 0 work; the audit text they replace is in `CHANGELOG-phases.md`.

## Stack

| Concern | What's in the repo |
|---|---|
| Framework | Next.js 16.2.6 (App Router), React 19.2, Tailwind 4, framer-motion (landing) |
| Auth | NextAuth v5 beta, Credentials provider, JWT session carrying `workspaceId`, `role` (`auth.ts`); route protection in `proxy.ts` (Next 16 replacement for middleware) |
| DB | Neon Postgres via `@neondatabase/serverless` HTTP driver (`lib/db/client.ts`, tagged-template `sql`). No ORM |
| Migrations | ✅ Versioned forward-only SQL in `db/migrations/NNNN_name.sql` + `schema_migrations` (checksummed, one transaction per file, statement splitter safe for `DO $$`), run by `scripts/migrate.mjs` (`--status`). `lib/db/schema.sql` and `migrate-workspaces.mjs` are gone — folded into `0001`/`0002` |
| AI | **OpenAI `gpt-4o-mini`** (migrated from Gemini on 2026-09-24 as `gpt-4o-mini`; default switched to mini 2026-09-25) behind `lib/ai/client.ts` (`generateJson` with strict JSON-schema structured outputs, `LlmProvider` adapter in `lib/ai/providers/openai.ts`, `OPENAI_API_KEY`/`OPENAI_MODEL`). Errors mapped to `QUOTA_EXCEEDED`/`RATE_LIMITED`/`NOT_CONFIGURED` |
| Email | **Phase 5:** `MailProvider` port (`lib/email/provider.ts`) with `ResendProvider` + `FakeMailProvider`; sending is the `campaign_send` job (`lib/domain/sending/*`), durable `messages` + `message_events`; webhook records delivered/opened/clicked/bounced/complained idempotently. Domains via `resend-domains.ts` |
| Scheduling | **Phase 5:** `POST /api/jobs/tick` (Bearer `CRON_SECRET`) runs the schedulers (`campaign_sends` enqueues due emails, `linkedin_queue`) then drains jobs; driven by `npm run worker` (`scripts/worker.mjs`) or `scripts/scheduler.mjs`/any pinger. `/api/cron/send-campaigns` is a deprecated alias for the tick. Request-triggered ticks never send email |
| Validation | ✅ zod at every JSON API route via `lib/api` (`withApi`, `parseJson`, `AppError`, envelope `{ok,…}` / `{ok:false,error,code,request_id}`). Server actions still hand-rolled (converted opportunistically) |
| Tests | ✅ Vitest; integration tests run on an in-process Postgres (PGlite) migrated from empty; the Neon driver is blocked in tests. Two-workspace isolation suite, compliance/dispatch, approvals, import, webhook, unsubscribe, crypto, migrations. The dangerous script is deleted. `npm run verify` = typecheck + lint + 2 static gates + tests + build |
| Logging | ✅ `lib/log.ts` structured JSON (secret-redacting) + `instrumentation.ts` `onRequestError`; `no-console` lint rule outside the logger. (There was no logging at all before — errors were simply thrown) |
| Extension | Manifest V3 Chrome extension in `chrome-extension/` |
| Python | **None yet.** Decision D-11: research/scoring moves into a separate Python service (`services/intelligence/`, "Intelligence Engine") starting Phase 2A. No web scraping, search, or research code exists anywhere today (the extension's page-text extraction is user-initiated capture only) |

## Data model that exists today (`db/migrations/0001…0004`)

Workspace-scoped and healthy: `workspaces`, `workspace_members` (roles), `do_not_contact`, `import_jobs`, `activities` (append-only), `approvals` (generic gate), `pipelines`/`pipeline_stages`/`deals`, `tasks`, `message_generations` (prompt audit), `prompts`/`prompt_versions`, `domains`, `mailboxes`, `forms`/`form_submissions`, `workflows`/`workflow_steps`.

Core outbound tables:

- `leads` — `full_name`, `email`, **`company` (free text)**, `job_title`, `linkedin_url`, `stage`, `source`. Unique `(workspace_id, lower(email))`.
- `segments` — saved AI-built filters (`criteria jsonb`).
- `campaigns` — status, channels, limits, `mailbox_id`, `approval_id`, `workflow_id`, counters.
- `campaign_steps` — `step_order`, `channel`, `wait_days`, `subject`, `body` (with `{{first_name}}`/`{{company}}` placeholders).
- `campaign_sends` — one row per (lead × step), **all pre-materialized at launch** with body rendered at launch and `scheduled_at`; `status` pending→sent/failed/queued; `provider_message_id`.

**Legacy debt:** `owner_email` still exists on `leads`, `segments`, `campaigns`, `crm_connections`, `api_tokens`. It is no longer the authorization boundary (`workspace_id` is) but still `NOT NULL`. `users.pitch` / `users.company` hold the sender's product positioning at *user* level rather than workspace level.

**Missing entirely** (required by PLAN): `companies`, `lead_research`, `signals`, `evidence`, `campaign_leads`, `messages`, `inbox_threads`, `agent_runs`, `agent_run_steps`, `usage_records`, `credit_ledger`, a `jobs` table, ICP config, `icp_score`/`intent_score` on leads.

## Feature inventory vs. V1 scope

Legend: **Keep** = maps directly to V1 · **Extend** = exists, needs work · **Hide** = works but off-strategy for V1, remove from nav behind a flag, don't delete · **Remove** = fake/dead · **Build** = doesn't exist.

| Area | State | Verdict |
|---|---|---|
| Auth + workspace + RBAC | Works. Signup → `createUser` → `ensureUserWorkspace` creates the workspace + owner membership | Keep; add onboarding checklist (Phase 1) |
| Leads CRUD, CSV import (papaparse), dedupe by email, import_jobs | Works, idempotent | Extend → Phase 1 (column mapping, preview, validation, domain-based company link) |
| AI Filter Builder / Segments ("Audience") | Works; company ground-truth matching | Keep, fold into Leads |
| Campaign wizard | Works end-to-end, 623-line component. **Contains decorative options and a fake predicted-reply-rate** (`hashRate()` → "20–27%") | Extend → Phase 4; remove fake rate |
| Sequence steps | `campaign_steps`, channel `email` or `linkedin_dm` | Extend; V1 = email only |
| Approvals engine | Generic, workspace-scoped, reused by campaigns/mailboxes/prompts/forms | **Keep — the compliance backbone.** Reuse for campaign approval |
| DNC + 14-day cooldown, pre-send recheck | Works (`lib/compliance.ts`, `dispatch.ts`) | Keep |
| Email send (Resend), domains, mailboxes w/ approval | Works; real key configured | Keep → Phase 5 hardens |
| Bounce/complaint webhook | Suppresses on bounce/complaint only | Extend: delivered/opened/**inbound reply** events |
| Unsubscribe link/route | Exists (`lib/unsubscribe.ts`, `/api/unsubscribe`) | Keep; verify RFC 8058 one-click headers |
| Dispatch/cron | In-request batch of 25, no retries/leases/idempotency keys, no dead-letter | **Replace → Phase 5** |
| Unified Inbox page | **Not an inbox.** It shows form submissions ("Unmatched Inbox") + Forms | Rebuild → Phase 6; move Forms elsewhere |
| Reply ingestion / classification / reply drafting | Not built | Build → Phase 6 |
| Company/lead research, signals, evidence, ICP scoring | Not built (`/dashboard/signals` and `/accounts` are `ComingSoon`) | Build → Phase 2: **Python Intelligence Engine (2A)** + app integration (2B) |
| AI message generation | Generic per-audience sequence step drafting; `{{placeholders}}`, no per-lead research input; prompt library w/ versions; audit in `message_generations` | Extend → Phase 3 |
| Deals, Tasks, Pipelines | Works | **Hide** (not core loop) — keep code, nav flag |
| Agentic Flows (React Flow builder) | Works; PLAN lists "complicated workflow builder" out of scope | **Hide** from nav; Campaign builder becomes the sequence editor |
| HubSpot OAuth (encrypted tokens) | Connect only, no sync | Hide under Settings → Integrations |
| Forms + public form pipeline | Works, approval-gated | Keep, move under Leads/Settings |
| API tokens, extension token | Works | Keep, Settings |
| Chrome extension | Scrapes profile via raw text + Gemini extraction, adds leads, **and sends real LinkedIn DMs** (`DRY_RUN=false`) | Extend as capture (Phase 7); **LinkedIn auto-send conflicts with PLAN §6 — see decision D-05** |
| Dashboard / Insight Board | Honest metrics on real data (AUD-04 done) | Extend → becomes Command Center (Phase 8) and Analytics (Phase 9) |
| Landing page | **Fake metrics**: `Hero.tsx` (A/B "42% higher CTR", "245 leads scored", campaign table with 17% rate), `Features.tsx` ("+31% Avg Reply Rate"), `AiTerminal.tsx` ("92%"). `SocialProof.tsx` shows real company logos (Linear, Vercel, Stripe, Clay…) under "Designed for modern GTM teams" which reads as customer endorsement | **Remove/replace → Phase 0 (removal), Phase 11 (final)** |
| Nav | 8 groups / ~25 items; `nav-config.ts` still says "LeadGennie Solutions Sales Agent"; 9 pages are `ComingSoon` stubs (accounts, crm-sync, help, knowledge, meetings, notifications, signals, usage, webhooks) | **Consolidate to 6 → Phase 0** |

## Known defects to fix in Phase 0

1. **Fake metrics** in wizard (`hashRate`) and landing page (see above) — violates PLAN rule 5 / AUD-04.
2. **Decorative wizard options** (news research, tone, localize, A/B) with no behaviour — remove until real (Phases 2/3 make two of them real).
3. **`scripts/test-campaign-compliance.mjs`** mutates workspace 1 in the live DB — replace with a real test harness against a dedicated test database.
4. **Migration runner** can't handle versioning or complex SQL — replace with ordered migrations + `schema_migrations` table.
5. **Hardcoded logo.dev publishable key** fallback in `SocialProof.tsx`; **delete/rotate the previously hardcoded Gemini key** (noted in earlier session) — Gemini is no longer used, so simply revoke it in Google AI Studio.
6. **Error handling** is inconsistent: server actions `throw new Error("…")`, API routes return ad-hoc `{ error }`.
7. **`owner_email`** columns still `NOT NULL` — plan a deprecation (stop writing, then drop) rather than leaving them as a second identity.
8. **LLM billing:** OpenAI is a paid API — set usage limits on the key and watch spend during Phase 2 research runs (decision D-02, decided).

## What is reusable as-is (do not rebuild)

`requireWorkspace/requireRole` (tenant boundary), `approvals` engine + `decideApproval`, `activities` + `logActivity`, DNC/cooldown, `lib/crypto.ts` (AES-256-GCM secrets), CSV import + `import_jobs`, prompt library + `message_generations`, domains/mailboxes with approval gating, Resend send + webhook verification, extension token auth (`lib/auth/extension-token.ts`), `AiFilterBuilder`, DashboardShell/Sidebar/Topbar shell, `generateJson` structured-output wrapper.

## Update — Phase 1 (2026-09-24)

Changes to what is true above (the audit tables describe the pre-rebuild repo):

- **Companies exist.** `companies` table + `leads.company_id`; `leads.company` (free text) is kept and remains the source for campaign placeholders. Matching lives in `lib/domain/companies` (pure planner + batch service); SQL in `lib/db/companies.ts`.
- **CSV import is a pipeline**, not one request: Upload → Map (auto-mapped headers) → Review (validation, in-file + existing dedupe, DNC) → chunked Import (`startImport` → `importLeadsChunk` × N → `finishImport`) with progress and an issues CSV. Code: `lib/domain/leads/import/*`, `lib/db/lead-import.ts`, `lib/actions/lead-import.ts`, `components/leads/import/*`. The old single-call `importLeadsCsv` is a deprecated wrapper.
- **Email validation:** `lib/domain/leads/email.ts` (syntax, free-mail, role, disposable, optional cached MX). Static lists are versioned (`EMAIL_LISTS_VERSION`).
- **Leads page** is server-paginated (50/page) with search, stage/source/email-status/company filters, sort, bulk add-to-DNC and bulk delete; `/dashboard/leads/[id]` is a minimal detail stub.
- **Positioning + ICP live on the workspace** (`/dashboard/settings/positioning`); `updateSenderPitch` dual-writes; the Command Center shows a checklist derived from real state.
- `requireWorkspace`/`requireRole` now throw `AppError` (`UNAUTHENTICATED`/`FORBIDDEN`, same messages) and guard a non-numeric `user.id`. Server actions that need to show a reason return `ActionResult` (`lib/api/action.ts`).
- Still true: no research/enrichment, no scoring, no CRM sync. Lead **stage** remains the only status column.

## Update — Phase 7 (2026-09-26)

- **The Chrome extension is a capture tool with real authentication.** It connects through LeadGennie's consent page (PKCE, per-user revocable tokens, Settings → Browser extension), captures leads into the same database (Phase 1 core: company/domain, provenance, activity), shows the workspace's real leads, and can start research. UI follows the dashboard design system. Code: `chrome-extension/` (no build step: ES modules), server: `app/api/extension/*`, `lib/domain/{extension,capture}`, `lib/extension/*`, `app/extension/connect`.
- **LinkedIn automation is off by default** (D-05): the send code (`chrome-extension/automation/`, `content/linkedin-automation.js`) is retained but inert unless `FEATURE_LINKEDIN_AUTOMATION=true` + scope + optional permission.
- `requireRole`'s ranking now lives in `lib/workspace-roles.ts` (DB-free; re-exported from `lib/workspace.ts`) so client components can use it. A static gate forbids any `"use client"` file from reaching `lib/db/client.ts`.
