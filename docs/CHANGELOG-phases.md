# Phase changelog

Evidence log for each phase. Newest first.

## Phase 2A — Intelligence Engine (code complete 2026-09-24; local + one live run; staging deploy pending)

`services/intelligence/` — Python 3.12, FastAPI, pydantic v2, uv. Spec: `phases/phase-02-lead-intelligence.md` → 2A; design: `intelligence-engine/`.

### What changed

| WP | Result |
|---|---|
| 2A.1 Skeleton + contract | pydantic contract → committed `openapi.json` (drift-checked); bearer + HMAC (`timestamp.METHOD.path.body`, ±5 min, two rotating secrets, **fails closed**); error envelope; `/healthz` `/readyz` `/v1/capabilities`; idempotent async runs (`POST/GET /v1/runs`, cancel, SSE); **fake mode** (6 fixture companies incl. quota/slow/partial faults); memory + Postgres stores (`intel` schema, checksummed SQL migrations); run resume after a crash; retryable failures restart on resubmit |
| 2A.2 Fetch + connectors | Guarded fetcher (SSRF: scheme/credentials/port, DNS + every redirect + connected-peer checks; robots; shared per-host limiter; size/type/timeout; injection scan) + website, web_search (Brave), news, jobs (Greenhouse/Lever/Ashby) connectors, deterministic planner, RSS via defusedxml |
| 2A.3 Extraction + LLM | Strict-schema OpenAI client (retry-once-with-error, usage/cost, budget checked before every call, quota mapping), `FakeLlm`; extraction with mandatory verbatim `source_span` (unverifiable items dropped; unstated dates and unbacked counts neutralised); injection lines redacted from prompts |
| 2A.4 Evidence Validator | 7 checks + confidence formula + standalone `POST /v1/evidence/validate`; fails closed when the LLM is unavailable/over budget |
| 2A.5 Agents + pipeline | Research, Signal, Qualification (+`/v1/score`), Outreach Research; `ResearchPipeline` (traced, budgeted, cancellable, partial-on-budget); scoring = pure functions |
| 2A.6 Hardening | Adversarial corpus (215 neg / 30 pos), 50-concurrent-run load test, boundary tests, Docker image, CI workflow, compose, root `verify:all`, docs |

### Bugs / design flaws found by the tests (all fixed, regression-tested)
1. **Job-board entity binding**: Acme's claim verified against Globex's board (any linked board counted as proof). Now the board must be linked from the *claimed company's* domain. (Found by the generated corpus.)
2. **Location conflict too blunt**: any other country in the page blocked cross-border expansion news. Now headquarters-based only.
3. **Tier arithmetic**: dated news on unlisted domains (0.6) could never verify → `dated_news` 0.75; partial entailment 0.8 → 0.9 (0.85×0.8 < 0.70).
4. **Cancel race**: cancelling a queued-but-not-started run could be overwritten by the run marking itself `running` (found by the restart test on Postgres).
5. **Rate limiter jitter**: slots were spaced but event-loop jitter bunched requests 0.1 ms apart at 10 ms spacing (load test) → limiter also tracks the actual last-send time.
6. **`ElementTree` element falsiness** (`a or b` on children-less XML elements) silently dropped feed dates; `registrable_domain` collapsed every `.example` host to `example`; strict-schema converter stripped properties named `title`/`default`; ruff autofix removed imports that new code needed — each has a test.
7. **Repo side effect (mine):** ESLint walked into `services/intelligence/.venv` (broke root `npm run lint`) → `services/**` ignored in ESLint and tsconfig.

### Acceptance criteria (2A subset) — evidence
| Criterion | Status | Evidence / caveat |
|---|---|---|
| Contract + fake mode usable by the Next side | ✅ | `openapi.json`; `make fake` / `docker compose up engine-fake`; contract invariants on every fixture |
| Private + HMAC; no product-table access; cannot send email | ✅ tests | boundary tests (no mail libs; every SQL string is `intel.*`); auth tests incl. rotation, skew, method/path binding, fail-closed |
| **Validator 0 false-verified** | ✅ | 215 generated negatives + 25 hand-written, sycophantic *and* honest judges; positives 0 missed. ⚠️ measured with a scripted judge, not live gpt-4o adversarially |
| Every source URL was fetched by the engine; unverified never scores/outreach | ✅ | `check_invariants` enforced before any result leaves the engine (+ contract tests) |
| Budgets hard; graceful partial | ✅ | pages / LLM calls / time / search all tested; partial result keeps invariants |
| Prompt-injection page inert | ✅ tests | redacted from prompts; injected snippet rejected; no confidence uplift |
| Idempotent + survives engine restart | ✅ | replay tests; **Postgres restart-mid-run test** |
| 50 concurrent runs, host rate respected | ✅ | 502 requests to one host in 5.0 s at a 100 rps cap; all 50 succeeded with invariants |
| Real run end-to-end | ✅ one site | `linear.app`: 5 pages, 4 LLM calls, ≈ $0.04, 17/17 verified, invariants OK |
| `make verify` green; staging deploy | ✅ / ❌ | ruff, format, import-linter (3 contracts), mypy strict (83 files), 185 tests, OpenAPI drift. **Staging not deployed (no host — D-12)** |

### Not done / deferred
- Staging deploy (D-12 host), live search provider run (needs `BRAVE_API_KEY`, D-03), live adversarial validator eval, LLM-proposed search queries, People mode + discovery connectors (Phase 8), `public_profiles`/`reddit` (deliberately never).
- **Next (2B):** app-side client (`lib/intelligence/*`), persistence with quarantine, jobs, ICP editor, lead detail page — against `make fake` first.

## Phase 1 — Lead foundation (code complete 2026-09-24; live backfill done; browser click-through pending)

### What changed

| WP | Result |
|---|---|
| 1.1 Companies | `0005` `companies` (+`name_key`, two partial unique indexes) and lead columns. `lib/domain/companies`: pure planner (`matcher.ts`) + batch service (constant queries per chunk) — domain match first, then normalized name; a name-only company adopts its domain; **two different domains are never merged** (flagged as a possible duplicate); free-mail/disposable domains never make a company. Backfills `scripts/backfill-{companies,lead-names,email-status}.mjs` (batched, keyset-paginated, idempotent; shared logic in `scripts/lib/backfill.mjs` importing the app's own normalizers). `/dashboard/leads/[id]` stub links to the company's leads |
| 1.2 Import pipeline | Upload → Map (header auto-mapper, override) → Review (first 20 rows, validation, in-file + existing dedupe, DNC) → chunked Import (≤200/chunk, progress bar, pause/**Retry** resumes the same job) → summary + issues-CSV download. Each chunk is ONE atomic statement (data-modifying CTEs) that writes rows **and** progress, and records its outcome under its index → redelivery is a no-op, a failed chunk never loses earlier ones, a poison row is isolated by a per-row fallback. Modes: skip existing / fill blank fields only (never overwrites). Email-less rows dedupe by LinkedIn profile slug. Server re-validates every row (never trusts the client preview) |
| 1.3 Email validation | `lib/domain/leads/email.ts` (syntax, free-mail, role, disposable, versioned lists), opt-in cached MX (`mx.ts`, `EmailVerifier` stub for later) |
| 1.4 Leads list | Server-side pagination (50), search, stage/source/email-status/company filters, sort (allow-listed), bulk add-to-DNC / delete, company autocomplete + domain + phone in the form; `blocked` derived live from DNC |
| 1.5 Onboarding | `0007` workspace `positioning/company_name/icp`; `/dashboard/settings/positioning`; dual-write from `updateSenderPitch`, reads workspace-first with legacy fallback (also the AI message generator); Command Center checklist derived from real state (only "dismissed" is stored) |

### Bugs found while building (not in the spec)
1. Neon returns `bigint` as **strings** — `insertLead`/`updateLeadFields`/`listLeads` returned string ids typed as `number` (the new bulk actions rejected them). Now coerced.
2. `requireWorkspace` did not guard a non-numeric `user.id` (the NaN bug the docs warn about) and threw plain `Error`s that server actions could not classify → now `AppError` (same messages) + guard.
3. The Phase 0 baseline import tests asserted the old upsert (overwrites non-empty fields, counts every re-import as "updated"); updated to the spec'd fill-blanks semantics, and the `it.todo` about email-less leads is now a real test.
4. Harness finding (not app): PGlite returns JS arrays for `text[]` where Postgres sends `{a,b}` — the Neon-protocol shim was fixed; it briefly made race-conflict reporting look wrong.

### Acceptance criteria — evidence

| Criterion | Status | Evidence / caveat |
|---|---|---|
| Import 1,000 leads without timeout; progress; re-import → 0 duplicates | ✅ tests, ✅ real server actions over HTTP, ⚠️ not on Neon, ⚠️ modal not clicked | Test: 1,000 rows/5 chunks, re-import created 0. Live-server run (built app, real NextAuth session, actions called with real action IDs; DB = in-memory PGlite behind a Neon-protocol shim, **not the real DB**): 1,000 messy rows (invalid, role, disposable, no-email, in-file dupes, DNC) → 958 created / 24 dup / 18 skipped / 17 risky in ~0.2 s, progress 200→1000; same file again → 0 created (982 dup); `update_blank` → 0 created; chunk redelivered → `alreadyProcessed`. Latency over real Neon (HTTP round trips) not measured |
| Duplicates (in-file + existing) detected and reported before commit | ✅ logic + `lookupExistingLeads` action; ⚠️ Review step not viewed in a browser | `previewImport` / `classifyAgainstExisting` unit-tested; lookup exercised live |
| Invalid/risky/disposable flagged with reasons before and after import | ✅ | Preview flags + stored `email_status` + report entries + list badge/tooltips; role/disposable/invalid tables (≈40 cases) |
| Auto-mapping for common exports; user can override | ✅ unit (≈40 header variants, Apollo/HubSpot shapes); ⚠️ override UI not clicked | Company-level LinkedIn columns are never mapped to the person |
| Every imported lead links to a company; existing leads backfilled; never crosses workspaces | ✅ code + tests + ✅ **live backfill run (approved)** | Live-server import: 2,161/2,161 leads linked. Backfill run twice = no-op (tests, incl. tiny batch size). Read-only dry run on the real DB (16 leads, 1 workspace): 8 distinct company strings → 8 companies, 0 merges; 9 single-word names (first name only, by design); 1 disposable email → `risky`. **Leads with free-mail and no company text get no company (by design).** Mission STOP conditions not triggered. **Live run 2026-09-24:** pass 1 → 8 companies created, 14 leads linked, 16 names split, 1 email flagged `risky`; pass 2 → 0/0/0 (no-op). Read back: 16 leads, 14 linked, 0 cross-workspace links; the 2 unlinked leads have no company text and no corporate email |
| Server-side pagination; 5,000 leads first page < 1 s | ✅ in-process | Test asserts < 1 s on 5,000; live server with 5,360 leads: first page ≈ 67 ms end-to-end, page 50 ≈ 69 ms, search ≈ 114 ms. Real Neon adds ~2 sequential round trips (count/facets in parallel, then rows) |
| DNC emails flagged and can't be enrolled | ✅ | Flag rendered ("Blocked"); imports keep DNC rows; enrollment gate is the existing `filterCompliantLeads` (existing compliance tests) |
| Onboarding checklist real; positioning + ICP at workspace level | ✅ live server | Checklist 1/4 → 3/4 as real data appeared; legacy wizard reads the workspace pitch; invalid excluded domain → field-level error |
| `npm run verify` green; isolation tests extended | ⚠️ | typecheck ✅, lint ✅ on all app code, `check:fake-metrics` ✅, `check:tenancy` ✅ (scans the new SQL), **288 tests ✅**, build ✅ (new routes compile). **`npm run lint` at repo root fails only on `services/intelligence/.venv/**` (a Python virtualenv from the parallel Phase 2A work is not in the ESLint ignores)** — not a Phase 1 file; fix is one `globalIgnores` entry. Isolation: new suite covers leads list/detail/bulk/companies/autocomplete/import/onboarding across two workspaces |
| Tag `phase-1-complete` | ❌ not done | No commits made (convention) |

### Not done / deferred (on purpose)
- **Bulk "assign segment"** → Phase 4 (segments have no static membership; see spec "Delivered as").
- `users.pitch/company` are **not dropped** (contract step of D-07), `owner_email` untouched.
- No enrichment/scoring/research/CRM sync; no campaign logic changed. Campaign placeholders still read `leads.company` (the typed text), not the canonical company name.

### Side effects on shared infrastructure
- `0005`–`0007` had **already been applied to the live database** by the Phase 0 session's migration run (see Phase 0 notes). I edited `0005` after it was first written, which the checksum guard flagged as `MODIFIED` on the live DB; I restored the file byte-for-byte (`db:migrate:status` → all applied). One consequence: `leads_workspace_linkedin_idx` from the original `0005` exists live but current queries match on the profile slug, so it is unused (harmless; drop in a future migration if desired).
- Read-only checks against the live DB (`db:migrate:status`, SELECT-only dry run), then — with your explicit approval — the three backfills (`--yes`), run twice. They wrote only `leads.company_id/first_name/last_name/email_status` and 8 `companies` rows (`source='backfill'`); reversible by nulling those columns and deleting those rows.
- A throwaway Next.js server (port 3457) and Neon-protocol shim (port 4555, in-memory) were run from the session scratchpad and stopped; `.next` was rebuilt by `npm run build`.

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
