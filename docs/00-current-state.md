# 00 — Current State (audited implementation map)

Audit date: 2026-09-24, against `main` @ `89c93dd`. Typecheck (`tsc --noEmit`) passes clean. `next build`, lint and app runtime were **not** run in this audit — Phase 0 must establish that baseline first.

## Stack

| Concern | What's in the repo |
|---|---|
| Framework | Next.js 16.2.6 (App Router), React 19.2, Tailwind 4, framer-motion, three.js (landing) |
| Auth | NextAuth v5 beta, Credentials provider, JWT session carrying `workspaceId`, `role` (`auth.ts`); route protection in `proxy.ts` (Next 16 replacement for middleware) |
| DB | Neon Postgres via `@neondatabase/serverless` HTTP driver (`lib/db/client.ts`, tagged-template `sql`). No ORM |
| Migrations | Single idempotent `lib/db/schema.sql` executed by `scripts/migrate.mjs`, which splits on `;`. No version table, no ordering, can't hold functions/`DO` blocks |
| AI | Gemini via `@google/genai` (`lib/ai/gemini.ts`, `generateJson` with JSON schema). Default `gemini-2.5-flash`. **Free tier = 20 req/day, shared by every AI feature** |
| Email | Resend (`lib/email/resend.ts`, domains via `resend-domains.ts`). Bounce/complaint webhook only |
| Scheduling | `GET /api/cron/send-campaigns` (Bearer `CRON_SECRET`), hit by `scripts/scheduler.mjs` (node-cron, always-on process) or an external pinger. Batch of 25, in-request |
| Validation | Hand-rolled per action. No zod/valibot |
| Tests | None. One ad-hoc script `scripts/test-campaign-compliance.mjs` that writes into **workspace 1 of whatever `DATABASE_URL` points at** |
| Logging | `console.*` only |
| Extension | Manifest V3 Chrome extension in `chrome-extension/` |
| Python | **None yet.** Decision D-11: research/scoring moves into a separate Python service (`services/intelligence/`, "Intelligence Engine") starting Phase 2A. No web scraping, search, or research code exists anywhere today (the extension's page-text extraction is user-initiated capture only) |

## Data model that exists today (`lib/db/schema.sql`)

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
| Nav | 8 groups / ~25 items; `nav-config.ts` still says "Juntrax Solutions Sales Agent"; 9 pages are `ComingSoon` stubs (accounts, crm-sync, help, knowledge, meetings, notifications, signals, usage, webhooks) | **Consolidate to 6 → Phase 0** |

## Known defects to fix in Phase 0

1. **Fake metrics** in wizard (`hashRate`) and landing page (see above) — violates PLAN rule 5 / AUD-04.
2. **Decorative wizard options** (news research, tone, localize, A/B) with no behaviour — remove until real (Phases 2/3 make two of them real).
3. **`scripts/test-campaign-compliance.mjs`** mutates workspace 1 in the live DB — replace with a real test harness against a dedicated test database.
4. **Migration runner** can't handle versioning or complex SQL — replace with ordered migrations + `schema_migrations` table.
5. **Hardcoded logo.dev publishable key** fallback in `SocialProof.tsx`; **rotate the previously hardcoded Gemini key** (noted in earlier session) if not already done.
6. **Error handling** is inconsistent: server actions `throw new Error("…")`, API routes return ad-hoc `{ error }`.
7. **`owner_email`** columns still `NOT NULL` — plan a deprecation (stop writing, then drop) rather than leaving them as a second identity.
8. **Gemini free-tier quota** (20/day) makes any multi-lead research flow impossible; billing must be enabled before Phase 2 testing (decision D-02).

## What is reusable as-is (do not rebuild)

`requireWorkspace/requireRole` (tenant boundary), `approvals` engine + `decideApproval`, `activities` + `logActivity`, DNC/cooldown, `lib/crypto.ts` (AES-256-GCM secrets), CSV import + `import_jobs`, prompt library + `message_generations`, domains/mailboxes with approval gating, Resend send + webhook verification, extension token auth (`lib/auth/extension-token.ts`), `AiFilterBuilder`, DashboardShell/Sidebar/Topbar shell, `generateJson` structured-output wrapper.
