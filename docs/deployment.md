# Deployment & Operations

Resolves decision **D-10** (deployment topology was undocumented). This file describes what the *code* requires; fill in the "Actual hosts" table with where you really run it.

## Topology

```
 Browser / Chrome extension ──► Next.js app (web)  ──► Neon Postgres
                                   ▲   ▲    ▲
        Resend webhooks ───────────┘   │    └── HubSpot OAuth redirect
        Scheduler (cron pinger) ───────┘  GET /api/cron/send-campaigns
```

| Component | Requirement |
|---|---|
| **Web app** | Next.js 16.2.6, Node ≥ 20. Any host that runs `next start` (Vercel, Railway, Fly, VPS). |
| **Database** | Neon Postgres. The app uses the HTTP driver — no connection pooling concerns. |
| **Scheduler** | *Something* must call `GET /api/cron/send-campaigns` with `Authorization: Bearer $CRON_SECRET` every few minutes. Either run `npm run scheduler` on an always-on host (pm2/systemd/Railway worker), or use an external pinger / platform cron. A serverless host cannot run `scripts/scheduler.mjs` itself. |
| **Email** | Resend (API key + verified sending domain + webhook). |

### Actual hosts (fill in)

| What | Where |
|---|---|
| Web app | _unknown — not recorded in the repo_ |
| Scheduler | _unknown_ |
| Database | Neon (project/branch names: _fill in_) |

## Environment variables

See [`.env.example`](../.env.example) for the authoritative, commented list. Required in every environment: `DATABASE_URL`, `AUTH_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `CRON_SECRET`. Features degrade without: `OPENAI_API_KEY` (AI), `RESEND_API_KEY`/`RESEND_WEBHOOK_SECRET` (email), `HUBSPOT_*` (integration).

`RESEND_FROM_EMAIL` appears in some `.env.local` files but **is not read by any code** — sender addresses come from `mailboxes`.

## Database migrations

Versioned, forward-only SQL in `db/migrations/NNNN_name.sql`, tracked in `schema_migrations` (version, name, checksum, applied_at). Each file runs in **one transaction** with its tracking row.

```bash
npm run db:migrate:status     # applied / pending / MODIFIED / UNKNOWN — changes nothing
npm run db:migrate            # apply pending, in order
npm run db:seed -- --yes      # demo user + is_demo workspace (never run against production data you care about)
```

Rules: never edit an applied migration (checksum mismatch aborts the run); add a new numbered file instead. The runner also aborts if the database has versions this checkout doesn't contain (someone deployed a newer branch).

**Deploy order for a release with a migration:** run `db:migrate` *before* the new code serves traffic when the migration only *adds* things; for a migration that removes/renames something the old code reads, split it across two releases (expand → migrate → contract).

> Migration `0004_api_token_hash` hashes existing API tokens in place and erases the plaintext. Extension installs that already hold the token keep working (the server now looks it up by hash), but the new code and the migration must be deployed together — code from before 0004 cannot authenticate the extension afterwards.

### Test database

Tests never touch Neon. `npm test` migrates an **in-process Postgres (PGlite) from empty** using the real migration files, and blocks the Neon driver entirely (`tests/setup.ts`). *Deviation from D-08's recommendation (a Neon test branch):* PGlite is hermetic, needs no credentials, and runs identically in CI. A Neon branch can be added later for driver-specific checks; if you do, never point it at the same database as `DATABASE_URL`.

## Webhooks & callback URLs (register these with the providers)

| Provider | URL | Auth |
|---|---|---|
| Resend → bounces/complaints | `POST {APP}/api/webhooks/resend` | Svix signature, `RESEND_WEBHOOK_SECRET` |
| HubSpot OAuth redirect | `{APP}/api/integrations/hubspot/callback` | OAuth `state` |
| Public forms | `POST {APP}/api/forms/{embedKey}/submit` | public, rate-limited by spam checks |
| Unsubscribe link | `{APP}/api/unsubscribe?…` | signed token |
| Cron | `GET {APP}/api/cron/send-campaigns` | `Bearer $CRON_SECRET` |
| Chrome extension | `{APP}/api/extension/*` | workspace API token (`Bearer`, stored hashed) |

## Verification before/after a deploy

`npm run verify` (typecheck → lint → fake-metric gate → tests → build). Then smoke: sign up → log in → create lead → import CSV → save segment → launch campaign (dry) → unsubscribe link → Resend webhook → form submit → extension token call.


## Phase 1 rollout (leads, companies, import, workspace ICP)

No new environment variables. Order matters:

1. `npm run db:migrate` — applies `0005` (companies + lead fields), `0006` (import progress), `0007` (workspace positioning/ICP; seeds it from each workspace creator's `users.pitch/company`). All additive — `ADD COLUMN` with constant defaults is metadata-only on Postgres 11+, so `leads` is not rewritten. **Applied migrations are frozen** (checksummed): fix forward with a new numbered file.
2. Backfills (each batched at 1,000, keyset-paginated, idempotent — a second run changes nothing; they refuse to run without `--yes`):
   ```
   node --env-file=.env.local scripts/backfill-companies.mjs    --yes   # companies from leads.company (+ corporate email domains) → leads.company_id
   node --env-file=.env.local scripts/backfill-lead-names.mjs   --yes   # first_name / last_name from full_name
   node --env-file=.env.local scripts/backfill-email-status.mjs --yes   # offline email_status (syntax / role / disposable) — no DNS
   ```
   Add `--env=DATABASE_URL_TEST` to run against the test branch first. Node ≥ 22.18 is required (the scripts import the app's pure TypeScript normalizers via type-stripping; a harmless `MODULE_TYPELESS_PACKAGE_JSON` warning is printed).
3. Nothing to schedule: imports run from the browser in ≤200-row chunks, each idempotent, so an interrupted import resumes with **Retry** in the modal.
