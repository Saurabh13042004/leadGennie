# Phase 1 — Lead Foundation

## Goal
A reliable lead + company system: import 1,000 leads without crashing, detect duplicates, flag invalid emails, and link every lead to a canonical company.

## Starting point
`leads` has `full_name`, `email`, free-text `company`, `job_title`, `linkedin_url`, `stage`, `source`. `importLeadsCsv` (`lib/actions/leads.ts`) + `ImportLeadsModal.tsx` (310 lines, papaparse) already do idempotent upsert by `(workspace_id, lower(email))` and record `import_jobs`. No company entity, no column-mapping step, no email validation beyond presence, imports run in one request.

## Scope

### WP1.1 — Companies
- Migration: `companies` table; `leads` gets `company_id, first_name, last_name, phone, source_url, email_status, updated_at` (see `03-data-model.md`).
- Backfill script (idempotent, batched): create `companies` from distinct normalized `leads.company` per workspace; set `company_id`; split `full_name` → first/last (best-effort, keep `full_name`).
- Company matching service `lib/domain/companies`: match by domain (from `company_domain` or email domain **excluding free-mail providers**), else by normalized name; create if none. Never merge across workspaces.
- Minimal company view: company name/domain on lead rows; `/dashboard/leads/[id]` stub linking to company (full page in Phase 2).

### WP1.2 — Import pipeline (Upload → Preview → Map → Validate → Dedupe → Import)
- Supported columns: `first_name, last_name, email, company, company_domain, job_title, linkedin_url` (+ `full_name`, `phone`).
- **Auto-mapping** of common header variants ("First Name", "E-mail", "Organization", "Website", "Title", "LinkedIn URL"…) with user override.
- **Preview** first 20 rows with mapped fields; **validation** report before commit: invalid email format, missing name/email, invalid LinkedIn URL, obvious role accounts (`info@`, `noreply@`) flagged as "risky", disposable domains flagged.
- **Dedupe** classification per row: `new | duplicate_in_file | existing (update|skip)`; user chooses "skip existing" or "update blank fields only" (never silently overwrite non-empty values).
- **Chunked import**: client uploads parsed rows in chunks of ≤200 to a route/action; server processes each chunk transactionally and updates `import_jobs` progress; UI shows progress; failure in a chunk doesn't lose earlier chunks; re-running is idempotent.
- Post-import summary (created/updated/duplicates/skipped/failed with downloadable error CSV) — extends existing `import_jobs.error_report`.
- Respect DNC at import: DNC emails imported but flagged `blocked` (don't silently drop, don't allow enrollment).

### WP1.3 — Email validation
`lib/domain/leads/email.ts`: syntax (RFC-pragmatic), free-mail detection, role-account detection, disposable-domain list (static, versioned), optional MX check (async, cached) → sets `email_status`. No third-party verifier in V1 (interface stub `EmailVerifier` for later).

### WP1.4 — Lead list UX
- `/dashboard/leads`: server-side pagination (page size 50), search, filter by stage/source/email_status, sort; bulk actions (add to DNC, delete, assign segment). Existing table (`LeadsTable.tsx` 176 lines) does client-side full-list load — replace with paginated query (1,000+ rows must stay fast).
- Lead form (create/edit) gains company + domain fields with company autocomplete.

### WP1.5 — Workspace onboarding checklist (D-07)
- Move `pitch/company` → `workspaces.positioning/company_name`; add `workspaces.icp` jsonb + a simple ICP form (industries, employee range, geos, target titles, exclusions). Dual-write from the existing profile action; reads switch to workspace.
- Dashboard shows a checklist: *Describe what you sell · Define ICP · Connect email · Import leads*. Persisted, derived from real state (no fake progress).

## Out of scope
Enrichment providers, research, scoring (Phase 2), person/company discovery, CRM sync, Chrome extension changes.

## Data changes
`0004_companies_and_lead_fields`, `0005_workspace_positioning_icp`, backfill scripts `backfill-companies.mjs`, `backfill-lead-names.mjs`.

## Interfaces
- `importLeadsChunk(importJobId, rows, options)`, `startImport(meta)`, `finishImport(id)` (server actions, envelope responses)
- `previewImport(rows)` → `{ mapped, errors, duplicates }` (pure, also unit-tested)
- `lib/domain/companies`: `matchOrCreateCompany(ctx, {name, domain})`
- `lib/domain/leads`: `validateLeadInput`, `classifyEmail`

## Tests
Header auto-mapping table tests · email classification table tests · dedupe (in-file + existing) · idempotent re-import · 1,000-row import completes < 30 s in test · chunk failure isolation · company matching (domain vs name, free-mail excluded) · isolation for `companies`.

## Acceptance criteria
- [ ] Import **1,000 leads** succeeds without timeout or crash; progress visible; re-import creates 0 duplicates
- [ ] Duplicates (in-file and existing) detected and reported before commit
- [ ] Invalid/risky/disposable emails flagged, with reasons, before and after import
- [ ] Column auto-mapping works for common CSV exports; user can override
- [ ] Every imported lead links to a `company` (existing leads backfilled); company matching never crosses workspaces
- [ ] Leads page paginates server-side; 5,000 leads loads < 1 s for first page
- [ ] DNC-listed emails are flagged and can't be enrolled
- [ ] Onboarding checklist reflects real state; positioning + ICP saved at workspace level
- [ ] `npm run verify` green; isolation tests extended

## Risks
Name-only company matching creates false merges → conservative normalization, never auto-merge two *different domains*; surface "possible duplicate company" rather than merging.
`full_name` split is lossy (e.g. single-token names) → keep `full_name` authoritative for display.

## Delivered as (deviations from this spec — recorded 2026-09-24)
- **Migrations** are `0005_companies_and_lead_fields`, `0006_import_job_progress`, `0007_workspace_positioning_icp` (`0004` was already taken by API-token hashing). Backfills also include a third script, `backfill-email-status.mjs`.
- **`importLeadsChunk(importJobId, { index, rows })`** — the chunk *index* is what makes redelivery a no-op. Options (`skip` | `update_blank`, `checkMx`) are supplied once to `startImport` and stored on the job; a chunk cannot change them. Envelope responses via `lib/api/action.ts` (`runAction`).
- **Email status semantics.** A syntactically invalid address rejects the row (reported, not imported); `invalid` therefore comes from the opt-in MX check (or later verifiers). `valid` = syntax OK + not risky + domain has an MX record (it does *not* prove the mailbox exists); default is `unverified`. `risky` = role account or disposable domain.
- **DNC `blocked`** is derived live from `do_not_contact` (never stored), so it cannot go stale; enrollment is still blocked by the existing `filterCompliantLeads`.
- **Import cap:** 5,000 rows per file; chunk size 200; error report capped at 5,000 entries. UI row numbers are spreadsheet rows (header = row 1).
- **Bulk "assign segment" is deferred to Phase 4.** Segments are saved *criteria* with no static membership; adding membership now would not affect campaign audiences (`audience_definition` lands in Phase 4) and would silently mislead. Bulk add-to-DNC and bulk delete are built.
- **ICP** is a simple v1 shape (`{version:1, industries, employee_range, geographies, titles, exclusions}`); Phase 2A maps it onto the engine's weighted schema.
- **Legacy `importLeadsCsv`** stays as a deprecated wrapper over the new pipeline; its semantics changed to *fill blanks only* (the old upsert overwrote non-empty values, which this spec forbids).
- **Companies without a name** (corporate email only) are named by their domain (`acme.com`) — never an invented display name. Free-mail-only leads with no company text get no company.

## Exit
Tag `phase-1-complete`. Mission: [`missions/phase-01-lead-foundation.md`](../missions/phase-01-lead-foundation.md).
