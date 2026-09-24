# Mission: Phase 0 — Codebase Stabilization

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-00-stabilization.md`.

## Objective
Leave the repo honest, tested, and structurally safe to extend: versioned migrations, structured errors, zod validation, tenant-isolation tests, no fake metrics, six-item nav. **Zero new product features.**

## Preconditions
- [ ] D-08 (test DB strategy) and D-10 (deployment topology) answered — or use the recommendations and record that you did.
- [ ] A Neon **test branch** URL exists as `DATABASE_URL_TEST` (ask the user to create it if not). You must never run tests against `DATABASE_URL`.

## Read first
`AGENTS.md`, `docs/00-current-state.md`, `lib/db/schema.sql`, `scripts/migrate.mjs`, `lib/auth/workspace-context.ts`, `lib/campaigns/dispatch.ts`, `lib/compliance.ts`, `components/campaigns/wizard/CampaignWizard.tsx`, `lib/nav-config.ts`, landing components (`Hero`, `Features`, `AiTerminal`, `SocialProof`, `DashboardPreview`), Next 16 docs for route handlers, `proxy.ts`, and `error.tsx`/`not-found.tsx`.

## Work packages (in order — commit each)
1. **WP0.1 Baseline** — run `lint` and `next build`, record results in `docs/CHANGELOG-phases.md`; fix only what's red. Add Vitest, `typecheck`/`test`/`verify` scripts, `.env.example`, `docs/deployment.md`. *Exit:* `npm run verify` runs (may still have known-red items listed).
2. **WP0.2 Migrations** — `db/migrations/0001_baseline.sql`, `schema_migrations`, new runner with `--status`, robust SQL statement handling; seed works on empty DB; demo workspace flagged. *Exit:* empty DB → migrate → seed → boot; second migrate is a no-op.
3. **WP0.3 API layer** — `lib/api/*` (envelope, `AppError`, zod parse), `lib/log.ts`, dashboard `error.tsx`/`not-found.tsx`; convert API routes listed in the spec. *Exit:* curl each route with bad input → structured error, no stack.
4. **WP0.4 Tenancy** — grep-audit every SQL on workspace tables; fix gaps; stop writing `owner_email` (+ nullable migration); hash API tokens with a legacy grace path; write the two-workspace isolation suite. *Exit:* isolation suite green; audit list of fixed queries in the report.
5. **WP0.5 Fake content removal** — wizard `hashRate` + decorative options; landing fake metrics + logo marquee; nav-config leftovers; add `scripts/checks/no-fake-metrics.mjs` and wire into `verify`. *Exit:* gate passes; view `/` and the wizard in the browser.
6. **WP0.6 Nav** — six items, Settings hub, legacy behind `NEXT_PUBLIC_SHOW_LEGACY_MODULES`, stubs 404/redirect when off, Forms under Leads, honest Inbox placeholder. *Exit:* click through every nav item in the running app.
7. **WP0.7 Hygiene** — split `CampaignWizard` (behavior-preserving), remove confirmed dead code, replace `scripts/test-campaign-compliance.mjs` with a Vitest test on the test DB.
8. **WP0.8 Baseline tests** — compliance/cooldown, dispatch precheck, import idempotency, approvals state machine, extension token, unsubscribe token, crypto round-trip.

## Do NOT
Add companies/research/agents/jobs tables · rewrite server actions wholesale · delete Deals/Tasks/Flows/HubSpot/Forms code · change the send logic beyond what tenancy/tests require · touch `.env.local` values · run anything destructive against the real database.

## Verification
`npm run verify`; empty-DB migrate/seed; manual smoke list from `docs/06-quality-and-testing.md`; browser check of `/`, `/login`, `/dashboard`, `/dashboard/leads`, `/dashboard/campaigns/new`; isolation suite output.

## STOP and ask if
Lint/build failures reveal a large unrelated backlog (>~50 errors) · token hashing would lock out the user's live extension and you need a re-issue plan · removing a landing section changes brand copy the user may want kept.

## Report
Format in `docs/missions/README.md`.
