# Phase changelog

Evidence log for each phase. Newest first.

## Phase 8 (basic slice) — "Ask Gennie" on the Command Center (2026-09-25; verified hermetically + live against real OpenAI and the real DB; browser click-through pending)

Prompt bar at the top of `/dashboard` → validated plan → **user approves** → deterministic run with live progress → results counted from the DB. Pulled forward on request; the rest of Phase 8 is untouched.

| Piece | Where |
|---|---|
| Pure agent core (no DB/service/mail imports — eslint + `agent-boundaries` test) | `lib/agent/` (types, tool registry: `find_leads`, `research_leads`, `rank_leads`; `plan.ts` validator; `planner.ts`; `orchestrator.ts` state machine) |
| Persistence + ports | `lib/db/gennie.ts`, `lib/domain/gennie/{service,services,jobs,view}.ts`, job type `gennie_run`, actions `lib/actions/gennie.ts` |
| UI | `components/gennie/*`, `app/dashboard/gennie/[runId]`, prompt bar + recent runs on `app/dashboard/page.tsx` |

Guarantees (each has a test): planning queues nothing · no approval, no run (a stray job is a no-op) · double-approve starts one run · plan re-validated at approval and args re-validated at every step · unknown tool / literal lead ids / extra keys rejected (strict schemas) · limits clamped with a warning · cancel stops fan-out (queued jobs canceled, engine runs asked to stop) · pause/resume · run state persisted → restart/double-delivery never re-queues research · counts come from the DB · tenant isolation (another workspace's run is NOT_FOUND) · no tool can send email or touch campaigns.

Bugs found on the way (fixed):
1. **`onJobSettled` closed any run referenced by a job's `agent_run_id` as if it were a research batch** (overwrote `progress`, marked runs `completed` even when paused/failed). Now only `*_batch` runs are settled by the hook (`lib/intelligence/jobs.ts`).
2. Plan validation required the model's step list to be in dependency order; a real model wrote a valid plan backwards and it was rejected. Validation is now graph-based and orders steps itself.
3. Logs dropped an error's `cause`, so "OpenAI request failed" was undiagnosable. `lib/log.ts` now serializes causes.
4. The planner wasn't told research was *unavailable*, so it substituted a different plan; it now is, and pointless follow-up questions on wholly-unsupported requests are dropped.

Live run (real `gpt-4o-mini`, real Neon, throwaway workspace, then deleted): 0 jobs before approval → approve → completed; ranking 92/83/71 and counts 4/4/3 equal the database; "email all my leads and schedule a campaign" → refused, not approvable; "do outbound" → asks what to do; prompt-injection → refusal note + read-only steps only.

Not verified: real-browser click-through of the UI; the research step against the real engine (not configured here — covered with the fake engine); credits (Phase 10).

## Phase 3 — AI personalization (code complete 2026-09-25; verified hermetically + against the real model; strict-judge "0 fabricated" NOT literally met; browser click-through and Neon migration pending)

**What exists**
- `lib/domain/personalization/`: `context.ts` (the only place that decides what evidence reaches the model: verified, current, recency-filtered, deduped, capped at 12, NEWS/FUNDING withheld unless the toggle is on — with a visible reason), `prompt.ts` (versioned `cold-email/v1`; evidence is data-tagged and tag-stripped), `validators.ts` (pure, deterministic), `generate.ts` (generate → validate → one rewrite with the checker's complaints → validate; never falls back to an unchecked draft), `drafts.ts` (single writer; lifecycle; edit history; approve re-checks against today's evidence), `service.ts` (bulk enqueue, tone), `jobs.ts` (`personalization` job), `segments.ts` (evidence highlights).
- Migration `0010`: `message_drafts`, `message_draft_edits`, `workspaces.tone`.
- UI: draft panel on the lead page (tone, "mention recent news" toggle, evidence-linked highlights with hover/focus source snippet, checker messages, edit/approve/reject, show original), bulk "Generate emails" with progress, review queue at Leads → *Email drafts*, tone setting under Positioning & ICP.
- Validators: schema, greeting/recipient, placeholders, links/emails, spam + fake-urgency + fake-familiarity + flattery + embellishment + speculation phrases, length, unknown named entities (Title-Case subjects handled), claim → evidence (id exists in the lead's verified set, phrase is in the text, numbers/names/words are in the cited evidence), event vocabulary must be a listed claim, and a lexical "every declarative sentence is made of evidence / the sender's own words / filler" check that also covers the tail of a claim sentence and the lead-in clause of a question.

**Evidence**

| Check | Result |
|---|---|
| `npm run verify` | exit 0 — 500 tests pass, 9 opt-in skipped (was 391) |
| Hallucination injection (unit) | 27 fabricated drafts (invented expansion/funding/hire counts/location/mutual connection/prior call/integration/customers/metrics/competitor/person/award/promotion/urgency/flattery/embellishment/inference/presupposition, cross-workspace evidence id, …): **27/27 rejected**; plus clean, no-evidence and known-false-positive controls that must pass |
| Integration (PGlite) | real research → real evidence rows → generate; hallucinating model → retry → `failed_validation` (approval refused; a human edit can rescue it); recovery on the rewrite; invalid JSON never persisted; foreign/unverified/superseded evidence excluded; tone in prompt; regenerate keeps history; edit keeps original + logs diff + warns not blocks; approval re-checks evidence; tenant isolation on every operation; bulk with a per-lead quota failure while the rest succeed; cap 50; no double-queue |
| Live eval (`gpt-4o-mini`, 32 cases; ~10 runs while tuning — last run: 29/32 pass, 18 on the first try, 11 after the one rewrite, 3 failed) | validators pass 81–91% across the last runs; **in every flagged statement I read, no invented fact, number, name, event or entity reached a passing draft**; a strict second-model judge still flags 1–5 passing drafts per run (5 in the last run), every one a *soft* problem (embellishment "seamless", generalisation, a presupposition inside a question, picking one of two conflicting evidence items) — so the spec line "0 fabricated statements under the judge" is **not** literally met; see `docs/reports/phase-03-personalization-eval.md` |

**What the live eval taught (each fixed, each with a regression test)**
1. First run: 9% passed. The unknown-entity check treated every word of a Title-Case subject ("Exploring Meeting Efficiency") as an invented company. Fixed (Title-Case subjects skip the capitalization test but still face the claim rules).
2. The model copied "Linear" from an example inside my own system prompt into an email about a different company — the entity check caught it. Prompt example made generic.
3. A digit rule flagged "B2B" as a number claim; a claim beginning a sentence ("With Dana Ortiz…") failed on its capitalised first word; a question containing "hiring" (from the sender's own positioning) was called an unsupported claim. All fixed.
4. Gaps found the other way: inference riding behind a valid claim ("…which suggests…", "apparently serves multiple B2B clients"), embellishment ("seamless"), flattery ("we're impressed"), and sender-product claims broader than the sender's own description ("increasing headcount", "specialize"). New checks + a prompt rule to copy the positioning sentence.
5. Numbers matched as substrings ("4" inside "14"); now whole numbers only.
6. **Latent bug in Phase 2B, fixed here:** `String(date).slice(0, 10)` turns a driver-returned `Date` into "Sun Sep 20" (the read model and the re-scoring job both did this). New `lib/db/dates.ts#dateOnly`, used in all three places.
7. The eval's own judge was over-flagging (questions, subject lines, statements the evidence states verbatim, self-contradicting flags); it was recalibrated and its output is post-filtered — the report's number is "statements with no support", not "anything the judge said".

**Deviations from the spec (deliberate)**
- The default prompt is code-versioned (`cold-email/v1`, recorded on every draft) rather than seeded into the Prompt Library: library templates are free-form and cannot carry the claim contract. A workspace's *published* email prompt still contributes its tone rules and prohibited claims, which can only make output stricter, and its id is recorded.
- The eval is a vitest live test (`npm run eval:personalization`), not `scripts/evals/personalization.mjs`, so it can import the real code path.
- Migration is `0010` (spec said `0011`; `0010` was free).
- Engine `POST /v1/evidence/validate` re-check of draft claims: not wired (the spec marks it optional); the deterministic layer is the gate.

**Known limits / recommendations**
- Validators prove traceability, not truth; the residual risk is soft inference. Closing it fully means an LLM entailment gate on every draft (≈ +1 cheap call). The strict judge over-flags, so gating on it would fail many acceptable drafts — a product decision (D-13 candidate), not something to switch on silently.
- Emails come out short (median ≈ 35 words) and safe rather than vivid: evidence-only writing with a fail-closed checker trades flair for trust. Tone changes are real but mild.
- Evidence-linked hover works on hover/focus; not exercised in a real browser (render tests only).
- Second attempts that still fail are stored `failed_validation` (≈ 3 of 32); the user sees the reasons and can edit.

**Owner-side:** apply migrations `0008`, `0009`, `0010` to Neon (`npm run db:migrate`); open a researched lead and generate a draft; decide whether to gate on an LLM entailment check.

## Live validation of `lead_research` (2026-09-25, real sites, gpt-4o-mini, no search provider)

Ran `scripts/smoke.py` on linear.app, posthog.com (ICP: B2B SaaS/dev-tools, 20–1000 employees; lead "Head of Growth"). Cost ≈ $0.04–0.05 and 25–35 s per run.

| Result | Detail |
|---|---|
| Evidence | 22 and 10 claims verified, 0 unverified, invariants OK on both |
| Outreach | Only verified, cited facts; no fabricated specifics reached the output |
| Generic fallback | `outreach_angle_replaced: contained unsupported specifics` fired on both — the validator failing closed, as designed |

Problems the first live runs exposed, fixed here (each is a general defect, not a per-site tweak):
1. **Inference in `why_contact`** ("indicating a large user base that could benefit…") — entailment now treats narrative claims as facts-only; outreach prompt tightened.
2. **Irrelevant hiring inflated intent** (engineering/product/CS hiring scored as sales intent) — only sales/marketing functions count as relevant hiring; `JOB_POSTING` weight lowered to 8. Linear intent 62 → 42.
3. **Industry unknown despite a verified description** — Qualification now classifies onto the closed taxonomy from the *verified* description (one extra LLM call, only when industry is missing); breakdown says "inferred from the company description". Linear ICP 35 → 55, PostHog 70 (qualified).
4. **Absent keyword reported as "does not match"** — absence in the pages read is now `unknown`, worded "not found in the pages we read".

Known limits (not defects): no search provider (D-03), so no news/funding/hiring-board signals beyond the site; HQ location is often not stated on marketing sites; `potential_problem` is a hypothesis and must be labelled as such in Phase 3 copy; "serves 40,000 companies" is a first-party marketing claim and should be attributed ("Linear says…") in generated copy.

## Phase 2B — Lead intelligence in the app (code complete 2026-09-25; verified hermetically + against the real engine process; browser click-through and Neon migration pending)

Spec: `phases/phase-02-lead-intelligence.md` → 2B. Engine side: see Phase 2A below.

### What changed

| WP | Result |
|---|---|
| 2B.1 Foundations | `0008` `jobs`, `usage_records`, `agent_runs`, `agent_run_steps`. **Job runtime** (`lib/jobs/`): Postgres queue, one-statement `FOR UPDATE SKIP LOCKED` claim, time-boxed leases (a crashed worker's job is re-claimed and counts as a failure), exponential backoff + jitter, dead-letter, cancel, idempotent enqueue, **wait-and-poll outcome** so a handler can wait on the engine across ticks without spending retries; `POST /api/jobs/tick` (secret-protected) + `scripts/scheduler.mjs` ticks every minute + best-effort `after()` kick. **LLM client** (`lib/ai/client.ts`): `generateObject` (zod-validated, retry-once with the error appended), token accounting via `onUsage`, `setLlmProvider` seam + `FakeLlm`. **Engine client** (`lib/intelligence/`): HMAC-signed `HttpIntelligenceClient` (byte-compatible with the Python verifier — proven by cross-language test vectors), engine errors mapped to `AppError` codes with a retryable flag, `FakeIntelligenceClient` (idempotent runs, restart/outage/quota faults) |
| 2B.2 Persistence | `0009` `lead_research`, `signals`, `evidence`, `field_provenance`, `prospect_candidates` + lead score columns. `persistResearch` is the **single writer**: re-checks the contract invariants (mirror of the engine's) and **quarantines** violators (nothing written), pre-allocates real ids for every cross-reference, writes everything in **one transaction**, never edits history (previous research/signals flip `is_current=false`), fills only BLANK company/lead fields **and only when the engine backed the value with evidence**, records provenance, imports the engine `trace[]` → `agent_run_steps` and `usage[]` → `usage_records` |
| 2B.3 Jobs | `lead_research`, `company_research`, `lead_scoring` handlers: submit under an opaque idempotency key → poll by rescheduling; engine restart (run forgotten) → resubmit same key; retryable vs permanent failures classified (quota / bad credentials / invalid result dead-letter immediately with an actionable message); batch run closes itself via a job-settled hook; bulk cap 50 |
| 2B.4 ICP editor | Existing lists-based ICP kept as the editable model + optional `scoring` block (weights, keywords, threshold; additive — old ICPs still parse). `toEngineIcp` maps it to the engine schema (free text stays free text — **the engine normalizes it**, no taxonomy duplicated in TS). "Test against a sample lead" scores an unsaved ICP through `/v1/score`. Saving a changed ICP queues background re-scoring of researched leads (idempotent per ICP fingerprint) |
| 2B.5 UI | Lead detail page: ICP score + confidence, **Why this lead?** checklist (each criterion → its source), verified buying signals with source links, outreach narrative (why now / why person / *hypothesis* labelled / angle), evidence with quoted snippets + verification %, collapsed **Unverified — not used** group with reasons, company card, people suggestions, honest states (not researched / researching (auto-refresh) / failed with reason / partial / engine not configured / insufficient evidence). Leads table: ICP + research + signal-badge columns, sort by score (unresearched **last** in both directions), filters (min score, research state), **Research selected** with live progress + cancel |
| Routes | `POST /api/leads/:id/research`, `POST /api/leads/research`, `POST /api/leads/:id/score`, `GET /api/leads/:id/intelligence`, `GET /api/research/:runId`, `POST /api/jobs/tick` |

### Engine changes required by 2B (Python, all tested; contract + golden fixtures regenerated)
Title criteria accept free-text `keywords` (whole-word match: "cto" never matches "director"); geographies accept names/cities/ISO/regions; `ResearchResult.scoring_inputs` (the normalized, verified attributes scored) so re-scoring after an ICP edit is a pure function of stored data; `POST /v1/score` now returns `why_fit` (templated, moved to the pure `scoring/explain.py`); fake pipeline emits a description field with evidence; `scripts/export_fixtures.py` writes the golden results the Next tests validate (`make contract` drift-checks them).

### Bugs / design flaws found by the tests (fixed, regression-tested)
1. **Ungrounded enrichment:** the first persistence wrote a company `description` that had no evidence behind it → enrichment now requires an evidence-backed field (rule 6).
2. **Engine saw workspace/record ids:** the idempotency key embedded them → now an opaque hash.
3. **Contract drift caught by the drift test:** the zod mirror omitted `task_costs`.
4. **Live test exposed id reuse:** after a DB reset ids restart, so deterministic keys replayed an old engine run (test-only; production ids never repeat) — the live test now randomizes sequences.
5. **Lint/gates:** a ref written during render, `any` in fixtures, and `0007`-hard-coded migration test — all fixed; the Phase 1 migration test now also proves 0008/0009 leave existing leads untouched (`research_status='none'`, scores `null`, never a fabricated 0).

### Acceptance criteria (2B subset) — evidence
| Criterion | Status | Evidence / caveat |
|---|---|---|
| Research from the UI; detail page shows why-contact/now/person/hypothesis/angle | ✅ components + queue + persistence tested; ⚠️ not clicked in a browser | 25 end-to-end integration tests; render tests for every component |
| Score 0–100 + breakdown + confidence; deterministic; unverified has zero influence | ✅ | engine property tests + `unverified` fixture persisted flagged, `intent = 0` |
| Signals with type, dated source link, confidence, verified badge | ✅ | read-model + render tests |
| Every displayed claim links to evidence the engine actually fetched; unverified separated & excluded | ✅ | invariants (8 violation classes quarantined, nothing written), http(s)-only URLs, unverified panel |
| 50-lead research as background jobs; survives worker **and** engine restart; progress; never blocks a request | ✅ | lease-recovery test, engine-restart resubmit test, 2-worker no-double-processing test, progress derived from jobs; ⚠️ 50-lead run measured only with the fake engine |
| Engine private/HMAC; no credentials to product tables; cannot send email | ✅ | cross-language signature vectors; **real engine over HTTP rejects a wrong secret**; boundary tests (2A) |
| Engine down ⇒ clear state + retries; no guessed fallback | ✅ | outage retry/backoff → recovery test, dead-letter after max attempts, "not configured" message |
| Invalid LLM/engine output ⇒ failure visible, nothing partial persisted | ✅ | contract-violation and quarantine tests assert zero rows in every research table |
| `usage_records` + `agent_run_steps` from engine `usage[]`/`trace[]` | ✅ | asserted in the end-to-end test |
| No findable info ⇒ "no evidence found", not invented text | ✅ | `none.example` result: insufficient evidence surfaced, no signals |
| Prompt-injection page cannot change behavior | ✅ (2A) | engine tests |
| Workspace isolation for all new tables/routes | ✅ | isolation test (research, read model, progress, cancel, scoring, list) + `check:tenancy` extended to the 10 new tables |
| `verify:all` green | ✅ | see numbers below |
| **Real engine end to end** | ✅ | `tests/live/intelligence-engine.live.test.ts`: real Python process, signed HTTP, real contract output → zod → invariants → DB → read model; quota failure surfaces as a permanent, actionable error |

Verification: `npm run verify` — typecheck ✅, lint ✅ (0 errors), `check:fake-metrics` ✅, `check:tenancy` ✅, tests ✅ (**391 passed**, 8 opt-in live/skipped; 30 files), build ✅ (all new routes/pages compile). `make -C services/intelligence verify` ✅ (189 tests, mypy strict, import contracts, OpenAPI + fixture drift).

### Not done / deferred (on purpose)
- **Migrations 0008/0009 are not applied to the real Neon database** (run `npm run db:migrate` — additive only). **No browser click-through** of the new pages (they compile and render in tests; authenticated pages need a session against the real DB).
- Real-model end-to-end through the Next queue (only the fake engine + one real-model engine smoke in 2A).
- Company-level result **reuse** across leads: each lead is its own run; the engine's source cache (`freshness_days`) removes repeat fetches but not repeat LLM calls. `company_research` handler exists (tested) but nothing in the UI triggers it (Phase 8 tool).
- The Next-side `onUsage` hook exists but existing callers (AI filter, message drafts) don't record usage yet — engine spend is fully metered; app-side LLM spend metering lands with credits (Phase 10).
- Generated TS types from OpenAPI: replaced by hand-written zod mirrors **plus drift tests** (openapi keys + golden fixtures) — same safety, one fewer toolchain.
- Signals use **supersession** (`is_current`) rather than the upsert-dedupe key sketched in `03-data-model.md`; evidence is one row per (claim, source).

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
| **Validator 0 false-verified** | ✅ | 215 generated negatives + 25 hand-written, sycophantic *and* honest judges; positives 0 missed. ⚠️ measured with a scripted judge, not live gpt-4o-mini adversarially |
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
