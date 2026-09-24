# Mission: Phase 1 — Lead Foundation

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-01-lead-foundation.md`.

## Objective
A user can import 1,000 leads through Upload → Preview → Map → Validate → Dedupe → Import, and every lead is linked to a canonical company. Workspace positioning and ICP are stored at workspace level.

## Preconditions
- [ ] Phase 0 Done (migrations runner, `verify`, isolation harness, API layer exist)
- [ ] D-07 answered (positioning/ICP on workspace) — or recommendation adopted and noted

## Read first
`lib/actions/leads.ts` (`importLeadsCsv`), `lib/db/leads-core.ts`, `lib/db/lead-matching.ts`, `components/leads/ImportLeadsModal.tsx`, `LeadsTable.tsx`, `LeadFormModal.tsx`, `lib/actions/profile.ts` (pitch), `lib/compliance.ts`, the `import_jobs` table usage.

## Work packages
1. **WP1.1 Companies** — migration `companies` + lead columns; idempotent batched backfills (companies from `leads.company`, first/last names); `lib/domain/companies` matching (domain → name; free-mail excluded). *Exit:* backfill run twice is a no-op; all existing leads have `company_id` where a company string existed.
2. **WP1.3 Email validation** — `lib/domain/leads/email.ts` (syntax, free-mail, role, disposable; optional cached MX) with table-driven tests. (Do before the import UI needs it.)
3. **WP1.2 Import pipeline** — pure `previewImport` + header auto-mapper (tested), chunked import actions with `import_jobs` progress, dedupe modes, DNC flagging, error CSV; rebuild the modal as a stepper (split into components). *Exit:* 1,000-row file imports in the running app with progress; re-import → 0 duplicates.
4. **WP1.4 Leads list** — server-side pagination/search/filter/sort; company autocomplete in the form. *Exit:* 5,000 seeded leads, first page < 1 s.
5. **WP1.5 Onboarding/ICP** — dual-write positioning to `workspaces`, ICP form, real-state checklist on the dashboard. *Exit:* checklist reflects actual data; old profile action still works.

## Do NOT
Call any research/enrichment provider · add scoring · build the lead detail page beyond a minimal stub · add CRM sync · change campaign logic (except reading `company` for placeholders through the new relation without breaking the old field).

## Verification
Unit tests (mapper, email, dedupe, company matching) · integration (chunk failure isolation, idempotency, isolation for `companies`) · manual: import a real messy CSV; view result summary and error CSV · `npm run verify`.

## STOP and ask if
Company name-only matching merges distinct companies in the real data (show samples) · `full_name` split heuristics break for a meaningful share of existing names · a migration would lock large tables in production.

## Report
Format in `docs/missions/README.md`.
