# 03 — Data Model

Principle: **extend existing tables, add only what's missing, never duplicate a concept.** PLAN.md §14–26 entities are mapped to what already exists.

## Mapping PLAN entities → repo

| PLAN entity | Repo today | Action |
|---|---|---|
| User | `users` | Keep. Move `company`/`pitch` positioning to `workspaces` (see below) |
| Workspace | `workspaces` | Extend: `positioning`, `icp` (jsonb), `default_tone`, `sender_name` |
| WorkspaceMember | `workspace_members` | Keep as-is |
| Lead | `leads` | Extend (see below). `stage` **is** PLAN's `status` — don't add a second column |
| Company | — (free-text `leads.company`) | **New** `companies` + `leads.company_id` + backfill |
| LeadResearch | — | **New** |
| Signal | — | **New** (engine proposes + verifies; Next persists) |
| Evidence | — | **New** (with verification metadata from the engine's Evidence Validator) |
| Campaign | `campaigns` | Extend: `total_limit`, `approved_at`, `READY` status, lifecycle enum |
| Sequence | — | **Not created.** One sequence per campaign in V1 → `campaign_steps` *is* the sequence. Reintroduce only when multi-sequence campaigns are needed |
| SequenceStep | `campaign_steps` | Extend: `status`, `template_kind`; keep `subject`/`body` as templates |
| CampaignLead | — | **New** (per-lead state machine; today implicit in pre-materialized `campaign_sends`) |
| Message | `campaign_sends` (outbound only) | **New** `messages` (both directions) linked to `campaign_sends` |
| InboxThread | — (today's "inbox" = `form_submissions`) | **New** `inbox_threads` |
| AgentRun | — | **New** `agent_runs` + `agent_run_steps` |
| Activity | `activities` | Extend: `actor_type`, `actor_id` (user \| agent \| system \| job) |
| UsageRecord | — | **New** `usage_records` (+ `credit_ledger` in Phase 10) |
| Job | — | **New** `jobs` (Phase 5; earlier phases may need a minimal version — see phases) |
| Approval | `approvals` | **Reuse** for campaign launch; new types as needed |

## New / changed tables (target shapes)

Column lists are the contract; exact types/indexes finalised in each phase's migration.

### `companies` (Phase 1)
`id, workspace_id, name, domain, linkedin_url, industry, employee_count, location, description, source, created_at, updated_at`
Unique `(workspace_id, lower(domain)) where domain is not null`. Name-only companies (from legacy `leads.company`) allowed with null domain; matched by normalized name within the workspace.
**Delivered (migration `0005`):** plus `name_key text not null` (conservative normalized name, matching only — legal suffixes stripped, descriptive words kept) and a second partial unique index `(workspace_id, name_key) where domain is null`. A company with a domain may share a `name_key` with another domain (surfaced as a possible duplicate, never auto-merged). For a domain-only company `name` = the domain and `name_key` = its first label. Matching rules: `lib/domain/companies/matcher.ts`.

### `leads` (extend, Phase 1)
Add: `first_name, last_name, phone, company_id → companies, source_url, icp_score int, intent_score int, scoring_version, research_status (none|queued|running|done|partial|failed), email_status (unverified|valid|invalid|risky), updated_at`. (`icp_score`/`intent_score` are written only from engine scoring results.)
**Delivered in Phase 1 (`0005`):** `company_id, first_name, last_name, phone, source_url, email_status (check-constrained), updated_at`. `icp_score/intent_score/scoring_version/research_status` are **not** added yet (Phase 2). Keep `full_name` (derived/backfilled from first/last; existing code reads it). Keep `stage` (values: `new, researched, qualified, contacted, replied, interested, meeting, won, lost, unsubscribed, bounced`). **Stop writing `owner_email`** (Phase 0), drop it after a release.

### `import_jobs` (extended in Phase 1, migration `0006`)
Existing table + `processed_rows, blocked_count, risky_count, options jsonb, chunk_results jsonb` (per-chunk outcome keyed by chunk index — the idempotency record), `idempotency_key` (unique per workspace), `finished_at, updated_at`. Status: `running → completed | completed_with_errors | interrupted`. `error_report` now holds `{row, severity, code, reason}` (capped at 5,000).

### `lead_research` (Phase 2)
`id, workspace_id, lead_id, company_id, summary, why_contact, why_now, why_person, potential_problem (hypothesis), recommended_angle, insufficient_evidence bool, icp_breakdown jsonb (criteria → {status, weight, points, value_found, evidence_ids}), icp_confidence, scoring_version, engine_run_id, engine_contract_version, status (complete|partial|failed), unknowns jsonb, warnings jsonb, agent_run_id, created_at, updated_at`. One current row per lead + history retained (versioned by `created_at`; `is_current`). Written **only** by `lib/intelligence/persist.ts` from a validated engine Research Result.

### `signals` (Phase 2)
`id, workspace_id, lead_id null, company_id, type (FUNDING|HIRING|EXPANSION|PRODUCT_LAUNCH|LEADERSHIP_CHANGE|TECH_CHANGE|JOB_POSTING|NEWS), title, description, source_url, source_type, confidence numeric(3,2), verified boolean, detected_at, expires_at null`.
Add: `verified boolean not null`, `verification_notes jsonb`, `conflicts_with bigint null`, `engine_signal_id text`. Dedupe key `(workspace_id, company_id, type, md5(coalesce(source_url,title)))`. Unverified signals are stored (for transparency) but **never** feed scores, `lead_research`, or generation prompts.

### `evidence` (Phase 2)
`id, workspace_id, lead_id null, company_id null, signal_id null, research_id null, claim, source_url, source_title, source_type (website|careers|news|linkedin|provider|user), snippet, captured_at, provider`.
Add: `verification jsonb` (`{verified, confidence, method[], checked_at, notes[]}`), `content_hash text`, `engine_evidence_id text`, `engine_run_id text`. `source_url` must be a URL the engine fetched (validated by the engine, re-checked at persist). Check: at least one of `lead_id|company_id` set. **Rule: any claim rendered as fact in the UI or fed to generation must join to ≥1 evidence row with `verification.verified = true`.**

### `field_provenance` (Phase 2)
`id, workspace_id, entity_type (lead|company), entity_id, field, value_hash, source (user|import|extension|engine), evidence_id null, confidence, set_by (user|job|agent), created_at`. Records where each enriched value came from; user-entered values are never overwritten by `source='engine'`.

### `prospect_candidates` (created in Phase 2, used in Phase 8)
`id, workspace_id, company_id null, name, title, linkedin_url null, email null, relevance text, evidence_ids, provider, provider_id, status (suggested|imported|dismissed), agent_run_id, created_at`. Discovery/people results land here; they become `leads` only through the Phase 1 import service after user/plan approval. Emails are never inferred.

### `campaigns` (extend, Phase 4)
Add: `total_limit int`, `daily_limit` (rename/alias of `daily_email_limit` for email-only V1), `approved_at`, `started_at`, `completed_at`, `created_by_user_id`, `audience_definition jsonb` (segment id / lead ids snapshot / filter). Status: `draft | ready | running | paused | completed | failed` (+ legacy values mapped in migration).

### `campaign_leads` (Phase 4/5)
`id, workspace_id, campaign_id, lead_id, status (pending|active|replied|completed|stopped|bounced|unsubscribed|blocked|failed), current_step int, next_action_at, stop_reason, entered_at, completed_at`.
Unique `(campaign_id, lead_id)`. This — not pre-rendered `campaign_sends` rows — becomes the scheduling source of truth; `campaign_sends` remains the per-step send record (idempotency key = `(campaign_lead_id, step_id)`).

### `messages` (Phase 5/6)
`id, workspace_id, thread_id, campaign_id null, campaign_send_id null, lead_id, direction (out|in), channel ('email'), subject, body, from_email, to_email, provider, provider_message_id, in_reply_to, status (queued|sent|delivered|bounced|complained|failed|received), sent_at, delivered_at, opened_at, replied_at, ai_drafted boolean, approved_by_user_id null, created_at`.
Unique `(provider, provider_message_id)`.

### `inbox_threads` (Phase 6)
`id, workspace_id, lead_id, campaign_id null, mailbox_id, subject, status (open|needs_response|snoozed|closed), classification (INTERESTED|NOT_INTERESTED|QUESTION|MEETING_REQUEST|OUT_OF_OFFICE|UNSUBSCRIBE|BOUNCE|OTHER), classification_confidence, last_message_at, assigned_user_id`.

### `agent_runs` / `agent_run_steps` (Phase 2 minimal, full Phase 8)
`agent_runs`: `id, workspace_id, user_id, type, input, plan, output, status (planned|awaiting_approval|running|paused|completed|failed|canceled), started_at, completed_at, error, tokens_used, credits_used, parent_run_id`.
`agent_run_steps`: `id, run_id, workspace_id, seq, agent, tool, input_summary, output_summary, status, duration_ms, tokens_in, tokens_out, credits, error, started_at`.

### `usage_records` (Phase 2 writes, Phase 10 enforces)
`id, workspace_id, user_id, kind (discovery|research|enrichment|ai_generation|email_send), units, credits, provider, model, tokens_in, tokens_out, ref_type, ref_id, agent_run_id null, created_at`. Append-only.

### `credit_ledger` (Phase 10)
`id, workspace_id, delta, reason, usage_record_id null, balance_after, created_at`. Balance = last row; reserves/holds for estimated run cost.

### `jobs` (Phase 5; minimal enqueue helper earlier)
See `02-architecture.md`.

### Engine-owned `intel` schema (Phase 2A — separate plain-SQL migrations in `services/intelligence/migrations/`, not in `db/migrations`)
`intel.runs (run_id, idempotency_key unique, task, status, progress, input_hash, result jsonb, trace jsonb, usage jsonb, error, created_at, finished_at, expires_at)`, `intel.source_cache (url_hash, url, fetched_at, etag, html_hash, text, source_type, expires_at)` — **public content only, no workspace identifiers**, `intel.host_limits` (shared per-host rate limiter). The engine's DB role cannot access the product schema; Next's role cannot rely on `intel` (it talks to the engine over HTTP).

### `schema_migrations` (Phase 0)
`version text primary key, name, applied_at, checksum`.

## Workspace-level config (extend `workspaces`)

**Delivered in Phase 1 (`0007`): `positioning`, `company_name`, `icp` (v1 shape, see `lib/domain/workspace/icp.ts`), `onboarding_dismissed_at`.** Target list: `positioning text` (what we sell, moved from `users.pitch`), `company_name`, `icp jsonb` (industries, employee range, geos, target titles/seniority, keyword signals, exclusions, weights, `min_score_to_qualify` — schema defined in `intelligence-engine/scoring.md`; taxonomy-valid values only), `default_tone text`, `sender_name`, `timezone`, `daily_send_cap`. ICP lives on the workspace so scoring, discovery and personalization all read the same definition.

## Migration strategy

1. **Phase 0:** introduce `db/migrations/NNNN_name.sql` (numbered, forward-only) + `schema_migrations`. `0001_baseline.sql` = current `schema.sql` verbatim. Replace `scripts/migrate.mjs` with a runner that applies pending files in order inside a transaction where possible, supports multi-statement files and `DO $$` blocks (proper statement handling, not `split(";")`), records checksums. `schema.sql` is deleted after baselining (or kept as generated snapshot).
2. **Every later phase** adds its own migration(s); never edit an applied one.
3. **Backfills** are separate, idempotent, resumable scripts (e.g. `companies` from `leads.company`; `first_name/last_name` from `full_name`) — run in batches, safe to re-run.
4. **Expand → migrate → contract** for anything destructive (`owner_email`, `users.pitch`): add new, dual-write, switch reads, stop writing old, drop in a later release.
5. **Clean-DB test:** CI creates an empty database, runs all migrations, runs the seed, runs tests (Phase 0 acceptance).
6. **Neon note:** the HTTP driver runs each `sql` call as its own request; use `sql.transaction([...])` for atomic multi-statement writes, and single-statement CTEs (`with … insert … returning`) where you need atomicity with reads.

## Indexing & performance baseline

Every workspace table: index on `(workspace_id, …)` for its main list query. Hot paths to index deliberately: `campaign_leads (status, next_action_at)`, `jobs (status, run_at)`, `messages (thread_id, created_at)`, `signals (workspace_id, company_id, detected_at desc)`, `usage_records (workspace_id, created_at)`.

## Retention & deletion

Deleting a lead cascades to `lead_research`, `signals` (lead-scoped), `evidence`, `campaign_leads`; `messages` are retained/anonymised only if legally required — default cascade. DNC/unsubscribe entries are **never** deleted with the lead (they must outlive it). Provide workspace export + delete before beta (Phase 11).

## Phase 0 database review (2026-09-24)

Reviewed the live schema against `lib/db/schema.sql` (read-only introspection) and against the target model above.

**Defects found and fixed (migrations `0001`–`0004`):**

| # | Finding | Fix |
|---|---|---|
| 1 | **Live DB had drifted from `schema.sql`**: `workspace_id NOT NULL` on 5 tables, unique `api_tokens(workspace_id)`, `api_tokens.owner_email` unique dropped, `crm_connections(workspace_id, provider, portal_id)` unique — all applied by hand via a one-off script and never recorded. A fresh DB would not have matched production | `0001` = old schema verbatim; `0002` codifies the drift (with backfill; fails loudly + rolls back on orphans). Verified by diffing an empty-DB migration against live introspection: identical except `crm_connections.workspace_id`, which live had nullable (0 rows) and `0002` now makes `NOT NULL` |
| 2 | No version table / ordering; runner split SQL on `;` | `schema_migrations` + checksummed, transactional runner |
| 3 | `owner_email` was a second identity, `NOT NULL` | `0003` nullable; no code writes it any more (contract step — drop later) |
| 4 | API tokens stored in plaintext | `0004`: `token_hash` (SHA-256) + `token_prefix`; legacy rows hashed in place and plaintext erased |
| 5 | 14 `UPDATE`s and 3 reads keyed on `id` alone (safe only because an earlier query checked ownership) | Scoped by `workspace_id`; enforced by `scripts/checks/workspace-scoped-sql.mjs` |
| 6 | `segments.criteria` defaults to `'{}'` but `normalize()` assumed keys existed → Audience page crash | `normalize()` defaults every key |
| 7 | Neon returns `bigint` as **string**; cooldown compared `Set<string>` to a number | Ids normalised with `Number()` (test harness emulates Neon's string ids) |

**Known, deliberately deferred (not "forgotten"):**
- `campaign_steps` / `workflow_steps` have no `workspace_id` (scoped via their parent). Both are reshaped in Phase 4 — add it then.
- Status columns are free `text` with no `CHECK`. Constraints are added per table when each status enum is redefined in its phase (adding them now would freeze legacy values).
- No `updated_at` on `leads`/`campaigns` — arrives with the Phase 1 `leads` extension.
- Leads without an email have no dedupe identity (re-import duplicates them) — Phase 1 matching by `linkedin_url` / company domain (`it.todo` in `tests/integration/import.test.ts`).

**Why the full target model (companies, lead_research, signals, evidence, campaign_leads, messages, inbox_threads, agent_runs, usage_records, credit_ledger, jobs) was NOT created in Phase 0:** none has code that reads or writes it; each is shaped by decisions still open (D-01 queue design, D-11 Python service boundary, D-04 mailbox provider); and creating empty speculative tables now means migrating them again later. The shapes above remain the contract, and the migration runner makes adding them cheap and safe. If you want the DDL for all of them landed up-front anyway, that is a small, separable task.

## As built (Phase 2B) — differences from the sketch above
- **Signals:** no upsert-dedupe key. Each research run inserts its signals and flips the previous run's to `is_current = false` (history kept, current view trivially correct). `signals.conflicts_with` holds signal ids.
- **Evidence:** one row per *(claim, source, snippet)*; `signal_id`/`research_id` link it to what it supports; `verified` is denormalized from `verification` (the engine's whole verdict) for indexing.
- **`lead_research`:** also stores `why_fit`, `intent_breakdown`, `scoring_inputs`, `qualified`, `evidence_ids` (narrative) and the engine run/contract version. One `is_current` row per lead (partial unique index).
- **Leads:** `icp_score`, `intent_score`, `scoring_version`, `qualified` are `NULL` until researched — never a default 0. `research_status ∈ none|queued|running|done|partial|failed`.
- **Jobs:** `attempts` counts *failures* (a wait-and-poll cycle is not one); an expired lease counts as a failure. Unique `(workspace_id, type, idempotency_key)`.
- **`agent_runs`:** a `research_batch` parent per user request and one `research_lead`/`research_company` child per job (steps + usage attach to the child).

## As built (Phase 3) — migration `0010`
- **`message_drafts`:** one row per generation attempt, never overwritten. `is_current` (partial unique on `workspace_id, lead_id, step_index, coalesce(campaign_id, 0)`) marks the draft the UI shows; regenerating flips the old one to history. `status ∈ draft|edited|approved|rejected|failed_validation`. `original_subject/original_body` keep the model's words after a user edit; `claims` is `[{text, evidence_id}]` (drives the highlights), `issues` is the validators' latest verdict (`error`/`warning`), `used_evidence_ids` only ever contains ids from the lead's verified evidence. Links: `generation_id → message_generations` (full prompt/model audit, CAM-03), `research_id`, `agent_run_id`, `prompt_version` (`cold-email/v1`, code-versioned) and `prompt_version_id` (a workspace's published Prompt Library version whose tone/prohibited rules were appended, if any).
- **`message_draft_edits`:** append-only before/after of every user edit with the validators' warnings for the edited text (a person owns their edits: warn, never block).
- **`workspaces.tone`:** `concise|friendly|formal|direct`, default `concise`.
- Written only by `lib/domain/personalization/drafts.ts` (single writer). Nothing in Phase 3 sends email.

## As built (Phase 4) — migration `0011`
- **`campaigns`:** `send_model ∈ legacy|leads` (every pre-existing row = `legacy` and keeps dispatching exactly as before; builder campaigns = `leads`), status check `draft|pending_approval|ready|running|paused|completed|failed|canceled|rejected` (legacy values kept), `total_limit`, `audience_definition` (source all/segment/leads + ICP filters), `send_window` (days/hours/IANA timezone), `tone`, `allow_template_fallback`, `created_by_user_id`, `approved_at`, `started_at`, `paused_at`, `completed_at`, `updated_at`. `daily_email_limit` is the daily limit (not renamed).
- **`campaign_steps`:** `mode ∈ template|personalized` (personalized = the lead's approved Phase 3 draft; only step 1), unique `(campaign_id, step_order)`. Follow-ups carry no subject: they send as `Re: <first subject>`.
- **`campaign_leads`:** as sketched, unique `(campaign_id, lead_id)`. Launch inserts enrolled leads `active` (with `next_action_at` = first send) **and** every considered-but-excluded lead as `blocked`/`stopped` with a human `stop_reason`, so nobody vanishes silently.
- **Compat send path (until Phase 5):** launch still materialises `campaign_sends` rows (rendered text + `scheduled_at` from the send-window planner) and the existing dispatcher sends them. New columns `campaign_sends.campaign_lead_id` (unique with `step_id` → one send per lead×step) and `message_draft_id`. The dispatcher updates `campaign_leads` after each outcome and completes the campaign when every lead has settled. Phase 5 replaces this with just-in-time `campaign_send` jobs reading `campaign_leads`.
