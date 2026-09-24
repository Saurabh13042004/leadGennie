# Phase 2 — Lead Intelligence (Intelligence Engine + app integration)

## Goal
Turn raw leads into *understood* leads: company + lead research, an explainable ICP score, buying signals, and **verified evidence** — surfaced on a lead detail page that answers **Why this lead? Why now? Why this person? What's the angle?** with sources.

Research runs in a new **Python service, the LeadGennie Intelligence Engine** (decision D-11; design in [`../intelligence-engine/`](../intelligence-engine/README.md)). Next.js owns the product, persistence, tenancy, jobs, credits and UI.

Phase 2 ships in two sub-phases, each independently verifiable:

| Sub-phase | Scope | Mission |
|---|---|---|
| **2A — Intelligence Engine** | Python service: contract, auth, connectors, agents, Evidence Validator, scoring; fake mode | [`phase-02a`](../missions/phase-02a-intelligence-engine.md) |
| **2B — Lead intelligence in the app** | Next-side client, foundations (LLM client, usage, jobs, agent runs), persistence, ICP editor, lead detail page, bulk research | [`phase-02b`](../missions/phase-02b-lead-intelligence-app.md) |

2B can start against the **fake engine** as soon as the 2A contract is merged (WP2A.1), so the two run in parallel after the contract lands.

## Starting point
No research/scoring/signals/evidence exists (`/dashboard/signals`, `/accounts` are stubs); no Python in the repo. `generateJson` exists in TS (OpenAI `gpt-4o` since 2026-09-24, `lib/ai/client.ts`). LLM cost/quota needs a spend limit on the key (**D-02**, decided). Data-source decision **D-03**: this phase uses web search + first-party sites + news + job pages on leads the user already has; **no people/company discovery provider yet** (Phase 8).

---

## Phase 2A — Intelligence Engine (Python)

### WP2A.1 — Skeleton, contract, auth (merge first)
- `services/intelligence/` per the README layout; FastAPI app, `pyproject.toml`/`uv.lock`, Dockerfile, `Makefile`, `.env.example`.
- **Contract** (`contracts/`): request/response/Research Result models exactly as `api-contract.md`; OpenAPI export; **fake mode** (`ENGINE_FAKE_MODE`) returning deterministic canned results for a few fixture companies (clean, thin, homonym, no-evidence).
- HMAC + bearer auth, request-id middleware, error envelope, `/healthz`, `/readyz`, `/v1/capabilities`.
- `intel` schema + Alembic migrations (`runs`, `source_cache`, `host_limits`); DB role restricted to `intel`.
- Root `npm run verify:all`, `docker-compose.yml` (Next + engine + Postgres), CI job for Python.
- **Exit:** Next-side developers can call the fake engine; contract tests run.

### WP2A.2 — Fetch layer & connectors
`sources/fetch.py` with all guardrails (SSRF, robots, rate limits, size/type/timeouts); connectors `website`, `web_search`, `news`, `jobs`; cleaning + JSON-LD capture; source cache with freshness. See [`sources.md`](../intelligence-engine/sources.md).
- **Exit:** SSRF suite green; cassette-backed collector tests; live `make smoke` on 3 public sites.

### WP2A.3 — Extraction
Deterministic extractors + LLM structured extraction with mandatory `source_span`s (`CompanyFacts`, `JobPosting[]`, `Event[]`). `llm/client.py` (structured output, retry-once, usage accounting, quota mapping, fake LLM).
- **Exit:** golden-file tests per fixture page; no extracted field without a span present in the text.

### WP2A.4 — Evidence Validator (build before the reasoning agents consume it)
Implement all seven checks, confidence formula, `POST /v1/evidence/validate`, adversarial corpus (~150 cases). See [`evidence-validator.md`](../intelligence-engine/agents/evidence-validator.md).
- **Exit:** **0 false-verified** on the adversarial suite.

### WP2A.5 — Agents
Research (company mode), Signal, Qualification (normalization + deterministic scoring, `POST /v1/score`), Outreach Research. Each: prompt v1, pydantic output, evals. Pipeline (`pipeline/run.py`) with planner, budgets, trace, usage, cancel, idempotency (`POST /v1/runs`, `GET /v1/runs/{id}`, cancel, optional SSE).
- **Exit:** end-to-end run on fixtures produces a Research Result satisfying **all contract invariants**; budget exhaustion yields a graceful partial.

### WP2A.6 — Hardening
Prompt-injection fixtures pass (no behavior change, no verification uplift); load test (50 concurrent budgeted runs, per-host limiter respected); structured logs with correlation ids; `docs/intelligence-engine/` updated with any deviations; deploy checklist executed on a staging host (D-12).

---

## Phase 2B — Lead intelligence in the app (Next.js)

### WP2B.1 — App foundations (needed by 2B and every later phase)
- **`lib/ai/client.ts`** — the single LLM entry for the Next side (zod validation, retry-once, token accounting, quota → `QUOTA_EXCEEDED`, `FakeLlm`). Builds on the existing `lib/ai/client.ts` / `providers/openai.ts` (add zod validation, retry-once, token accounting → `usage_records`, `FakeLlm`).
- **`usage_records`**, **minimal `jobs` + `enqueue()`** + `/api/jobs/tick` (hardened in Phase 5), **minimal `agent_runs/agent_run_steps`** (so research runs are already observable; Phase 8 is additive).
- **`lib/intelligence/`** — `client.ts` (signed HTTP, timeouts, retries, idempotency), `schemas.ts` (zod mirrors; `npm run gen:intelligence` for generated types), `fake.ts` (`FakeIntelligenceClient`), `persist.ts` (see 2B.2). Env: `INTELLIGENCE_URL`, `INTELLIGENCE_SIGNING_SECRET`.

### WP2B.2 — Persistence (defensive)
`persist.ts` maps a **validated** Research Result to product tables in one transaction through domain services: `companies` (fields + `field_provenance`), `signals`, `evidence` (with `verification` json, `content_hash`, `captured_at`), `lead_research` (why_contact/why_now/why_person/potential_problem/recommended_angle, `icp_breakdown`), `leads.icp_score/intent_score/research_status`. Local ids (`ev_1`) → DB ids. Re-checks invariants (every `evidence_ids` resolves; source URLs present; unverified items never referenced by scores/outreach) and **quarantines** violating payloads (dead job + engine `run_id`, no writes). Appends `agent_run_steps` from `trace[]`, `usage_records` from `usage[]`. Idempotent per `(lead, research_version)`; re-research is an explicit action that creates a new `lead_research` row (history kept).

### WP2B.3 — Jobs & orchestration of research
`company_research`, `lead_research`, `lead_scoring` job handlers: build request from DB (company/lead + `workspaces.icp/positioning`) → `POST /v1/runs` with idempotency key → poll by rescheduling → validate → persist. Company-level results reused across leads at the same company for `freshness_days`. ICP change ⇒ enqueue `lead_scoring` (calls `POST /v1/score`, no research rerun). Per-run caps (default 50 leads), progress in `agent_runs`.

### WP2B.4 — ICP editor (Settings)
Structured form producing `workspaces.icp` per `scoring.md` (taxonomy-valid values), weight sliders normalized to 100, exclusions, min score; "Test against a sample lead" calls `POST /v1/score` and shows the breakdown.

### WP2B.5 — Lead detail page `/dashboard/leads/[id]`
Sections (PLAN §29): header (name, title @ company) · **ICP score + confidence** and **Why this lead?** checklist (✓ met / ~ partial / ✗ not met / ? unknown, each linked to evidence) · **Company** card · **Why now / Buying signals** (type, title, date, source link, confidence, verified badge) · **Why this person** · **Potential problem** (labelled *hypothesis*) · **Recommended angle** · **Evidence** list (claim → source title → URL → captured date → verification confidence) · "N verified sources" summary · activity timeline · actions: **Research with Gennie**, Re-score, Refresh evidence, *Generate outreach* (enabled in Phase 3), Edit. Unverified items shown in a separate collapsed "Unverified (not used)" group with reasons. Honest states: "Not researched yet", "Research engine unavailable", "No evidence found", "Partial — budget reached".
Leads table: ICP/intent columns, research status, signal badges; sort/filter by score. Bulk **Research selected** with progress and cap.

### WP2B.6 — Cleanup
Remove any TS-side scraping/grounding ideas from older notes; make sure `/dashboard/signals` and `/accounts` stubs stay hidden (Phase 0) or are replaced by views over `signals`/`companies` only if trivially real.

---

## Out of scope
Discovery/people search & candidate import (Phase 8, D-03) · outreach copy generation (Phase 3) · credits *enforcement* (usage is recorded, gating is Phase 10) · `public_profiles`/`reddit`/headless rendering · email-address inference · Chrome extension changes.

## Data changes (Next.js — migrations `0006`–`0010`)
`usage_records`, `jobs` (minimal), `agent_runs`/`agent_run_steps`, `lead_research`, `signals`, `evidence` (+`verification jsonb`, `content_hash`), `field_provenance`, lead score columns, `prospect_candidates` (created empty now, used in Phase 8). Engine: Alembic `intel` schema. Isolation tests for every new Next table.

## Interfaces
Next: `POST /api/leads/:id/research` · `POST /api/leads/research` (bulk) · `POST /api/leads/:id/score` · `GET /api/leads/:id` · `GET/PUT /api/settings/icp` · internal `IntelligenceClient`. Engine: see `api-contract.md`.

## Tests
- **Engine:** SSRF/guardrails, collectors (cassettes), extraction goldens, **validator adversarial suite (0 false-verified)**, scoring properties (unverified has no effect), agent evals with fake LLM (hallucinated claim, injection page, no-evidence), API (HMAC, skew, idempotency, budgets, cancel), contract invariants on every fixture.
- **Next:** persistence maps everything correctly; invariant-violating payload quarantined with no writes; `FakeIntelligenceClient` flows; job idempotency (double delivery ⇒ one persistence); engine-down handling; quota error surfacing; isolation for all new tables/routes; contract test (zod vs engine fixtures).

## Acceptance criteria
- [ ] A lead can be researched from the UI; the detail page shows why-contact / why-now / why-person / hypothesis / angle
- [ ] ICP score 0–100 with per-criterion breakdown and confidence; identical inputs ⇒ identical score; unverified data has zero influence
- [ ] Signals shown with type, dated source link, confidence, verified badge
- [ ] **Every displayed factual claim links to ≥1 evidence row whose source URL the engine actually fetched**; unverified items are separated, labelled, and excluded from scores and downstream prompts
- [ ] Evidence Validator: **0 false-verified** on the adversarial suite; fabricated URLs/snippets never verify
- [ ] Research of 50 leads runs as background jobs, survives a Next worker restart *and* an engine restart mid-run (idempotent resubmission), shows progress, never blocks a request
- [ ] Engine is private + HMAC-authenticated; has no credentials to product tables; cannot send email (verified by config/test)
- [ ] Engine down ⇒ clear UI state and retries; **no LLM-guessed fallback**
- [ ] All LLM outputs schema-validated (pydantic and zod); invalid ⇒ retry once ⇒ visible failure, nothing partial persisted
- [ ] `usage_records` and `agent_run_steps` recorded from engine `usage[]`/`trace[]`
- [ ] A lead with no findable info shows "no evidence found", not invented text
- [ ] Prompt-injection fixture page cannot change tool behavior or raise verification
- [ ] Workspace isolation holds for all new tables/routes; `verify:all` green (Next + Python + contract)

## Risks
- **Hallucinated signals/citations** → URL-must-be-fetched rule, snippet-verbatim check, entailment, fail-closed.
- **Search/news API cost and terms (D-03)** → budgets per run, caching, company-level reuse, provider adapter.
- **Scraping legality/ToS** → robots, public pages only, honest UA, no profile-site scraping, no evasion; legal sign-off before adding `public_profiles`/`reddit`.
- **Two runtimes = ops overhead** → fake modes on both sides, single `verify:all`, compose file, contract CI, D-12 hosting choice.
- **Quota (D-02)** → resolve before starting 2A evals.
- **Latency** (a full run may take 30–120 s) → async runs, progress stages, partial results, cache.

## Exit
Tag `phase-2-complete` (Milestone M1) after 2A and 2B both pass. Missions: [`2A`](../missions/phase-02a-intelligence-engine.md), [`2B`](../missions/phase-02b-lead-intelligence-app.md). Agent specs: [`intelligence-engine/agents/`](../intelligence-engine/agents/), [`lead-agent`](../product-agents/lead-agent.md).
