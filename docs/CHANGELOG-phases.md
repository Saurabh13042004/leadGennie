# Phase changelog

Evidence log for each phase. Newest first.

## Phase 0 — Stabilization (in progress, started 2026-09-24)

### Baseline recorded 2026-09-24 (before any Phase 0 change)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `next build` | ✅ passes (Next 16.2.6 / Turbopack) |
| `eslint` | ❌ **57 problems: 38 errors, 19 warnings.** 29 errors are `no-explicit-any` in the vendored `components/LiquidEther.tsx` (third-party WebGL effect); the rest are in landing components (`AiTerminal`, `BookDemoModal`, `DashboardPreview`, `security/page`) |
| Tests | none existed |
| Live DB vs `lib/db/schema.sql` | **Drift found**: production had `workspace_id NOT NULL` on 5 tables, `api_tokens_workspace_id_idx` unique, `api_tokens.owner_email` unique dropped, `crm_connections_workspace_provider_portal_idx` — all applied by hand via the one-off `scripts/migrate-workspaces.mjs`, never recorded in `schema.sql`. Captured in `0002_workspace_enforcement.sql`. |

### What changed

| WP | Result |
|---|---|
| 0.1 Tooling | Vitest + zod added; scripts `typecheck`, `test`, `verify` (typecheck → lint → `check:fake-metrics` → `check:tenancy` → tests → build); `.env.example`; `docs/deployment.md`. ESLint 38 errors → **0** (deleted unused `LiquidEther`/`DashboardPreview`; fixed hooks/entities lint properly, no rule disabled). `three`/`@types/three` removed (unused). `@types/node` bumped to ^22 (Vitest 5 peer) |
| 0.2 Migrations | `db/migrations/0001–0004` + checksummed transactional runner (`scripts/migrate.mjs --status`), splitter safe for `DO $$`. Seed refactored to `scripts/lib/seed-demo.mjs` (demo workspace `is_demo=true`, no hard-coded password — old `migrate.mjs` seeded `demo1234`). `schema.sql`, `migrate-workspaces.mjs`, `test-campaign-compliance.mjs` deleted |
| 0.3 API layer | `lib/api/*` (`withApi`, `parseJson`, `AppError`, envelope — additive so the installed extension keeps working), `lib/log.ts`, `instrumentation.ts`, `app/dashboard/error.tsx` + `not-found.tsx`. Converted: register, book-demo, unsubscribe, cron, resend webhook, forms submit, all 4 extension routes. HubSpot connect/callback are redirect flows — left as redirects (only `owner_email` write removed) |
| 0.4 Tenancy | Static gate found **14 unscoped UPDATEs** (approvals, campaigns, forms, mailboxes, prompts, 8 in dispatch) + 3 unscoped reads → all scoped. No code writes `owner_email`. API tokens hashed (0004). Two-workspace isolation suite over 29 actions + extension API |
| 0.5 Fake content | Wizard: `hashRate` forecast + 4 decorative options removed (wizard is now 3 steps). AI Filter "guessed" count (`hashToRange`) → "Not measurable". Landing: `Hero` mock dashboard, `SocialProof` logo marquee, `Integrations` (claimed Salesforce/Pipedrive/Zapier/WhatsApp sync), `AiTerminal` (invented 92%/412/14) removed; `Features` copy corrected (it claimed SMS, bi-directional Salesforce/Pipedrive sync, domain rotation/warm-up — none exist). Hard-coded logo.dev key gone. `nav-config` "Juntrax" gone |
| 0.6 Nav | Six items; Settings hub; legacy modules behind `NEXT_PUBLIC_SHOW_LEGACY_MODULES`; pure stubs 404 when off; Forms/Unmatched moved to Leads → Inbound; Inbox + Analytics are honest empty states |
| 0.7 Hygiene | `CampaignWizard` 623 → 47 lines (+ hook + 3 step components, all < 210). Dead code removed (confirmed no importers) |
| 0.8 Tests | 121 tests: compliance/cooldown, dispatch pre-send recheck, unsubscribe (incl. mid-sequence stop), approvals state machine, import idempotency, extension token + validation, Resend webhook, cron auth, crypto, logger redaction, API envelope (no stack leak), migrations (empty DB, no-op re-run, tamper/unknown detection, rollback, legacy-token upgrade), seed, both static gates |

### Bugs found by writing the tests (not in the spec)
1. `segments.criteria` default `'{}'` crashed `listSegments`/Audience page (`normalize` didn't default keys).
2. Cooldown compared `Set<string>` (Neon bigint-as-string) against a number.
3. Extension "sent" report double-counted `campaigns.sent_count` when repeated.
4. Live DB had drifted from `schema.sql` (see baseline table).
5. Unsubscribe page echoed the address unescaped.
6. The workspace-scope gate itself crashed on a missing `app/` dir (its "fails on…" tests were passing for the wrong reason until they asserted on the message).

### Acceptance criteria — evidence

| Criterion | Status | Evidence / caveat |
|---|---|---|
| Auth works: sign up → login → protected redirect | ✅ live | Against the real DB via HTTP: register 200, duplicate 409, login 302 + session (email/workspace/role), wrong password → no session, `/dashboard` unauthenticated → 307 `/login`. **Logout not exercised; no real browser used** |
| Existing dashboard/leads/campaigns/deliverability still work | ⚠️ partial | 24 dashboard URLs requested with a real session: all 200 (stubs 404 as designed). Server actions covered by tests. **Interactive flows (create/edit lead, CSV import, wizard clicks) not exercised in a browser** |
| Empty DB → migrate → seed → boots; re-run is a no-op | ⚠️ partial | Empty-DB migrate + seed + re-run verified on PGlite (tests). Live DB: applied, then "Database is up to date". **App boot against a truly empty Neon DB not done** |
| No fake metrics (UI + landing) | ✅ / ⚠️ | Gate passes (and is tested to fail on each pattern); `curl /` grep for the old strings = 0. **Manual visual review of `/` not done** |
| Wizard: no invented reply-rate, no non-functional options | ✅ code, ⚠️ visual | Removed in code + gate; **not viewed in a browser** |
| API errors structured, no stack traces | ✅ live | curl of every converted route: envelope with `code` + `request_id`; unhandled-error path tested to leak nothing. **Dashboard `error.tsx` boundary not triggered live** |
| Every workspace query scoped; isolation tests pass; no `owner_email` writes | ✅ | Gate OK; isolation suite green; `grep owner_email` in app/lib = none |
| API tokens hashed | ✅ live | Real workspace token: hash present, plaintext erased; valid token → 200, altered → 401 |
| Six nav items; legacy behind flag; no reachable ComingSoon | ✅ live | Sidebar HTML has exactly the six; stubs 404. Note: stub 404 renders my "Page not found" but without the dashboard shell |
| `npm run verify` | ✅ | exit 0 (see final run) |
| `deployment.md`, `.env.example`, this changelog | ✅ | |
| Tag `phase-0-complete` | ❌ not done | No commits were made (convention: only when asked) |

### Side effects on shared infrastructure
- Migrations `0001–0004` applied to the database in `.env.local` (approved). The runner **also applied `0005`–`0007`**, which belong to a parallel session's Phase 1 work (additive: `companies`, lead columns, import-job progress, workspace ICP). Those files are now *applied* — editing them will trip the checksum guard; changes need a new migration.
- A throwaway smoke user/workspace/token were created on the live DB and deleted afterwards (counts back to 1 user / 1 workspace / 1 token).
