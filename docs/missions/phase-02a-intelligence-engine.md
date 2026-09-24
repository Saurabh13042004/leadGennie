# Mission: Phase 2A — LeadGennie Intelligence Engine (Python)

> Read `docs/missions/_preamble.md` first, then `docs/intelligence-engine/README.md`. Spec: `docs/phases/phase-02-lead-intelligence.md` → *Phase 2A*.
> Python-specific rules and toolchain: `docs/intelligence-engine/development.md`. **You are building a separate service; you do not write Next.js code in this mission** (except the repo-level `verify:all` script and compose file).

## Objective
A private, HMAC-authenticated Python service that, given a company (+ optional lead) and workspace ICP, collects public information within budgets, extracts and reasons over it with five agents, **verifies every claim against evidence it fetched itself**, scores ICP/intent deterministically, and returns a contract-valid Research Result — plus a fake mode so the app can be built in parallel.

## Preconditions
- [ ] Phase 0 Done (Phase 1 is *not* required — the engine doesn't depend on the lead schema)
- [ ] **D-11** recorded; **D-12** answered enough to pick a staging host, or use the recommendation and note it
- [ ] **D-02**: OpenAI key with budget available for evals · **D-03**: a search/news provider chosen for `web_search`/`news` (verify current API terms/pricing) or explicitly use a minimal free option for the smoke tests
- [ ] Python 3.12 + `uv` + Docker available locally

## Read first
`docs/intelligence-engine/{README,api-contract,sources,scoring,development}.md`, all five `agents/*.md`, `docs/02-architecture.md` (evidence pipeline, tenancy), `docs/04-engineering-rules.md`. Verify current APIs/docs for: FastAPI, pydantic v2, OpenAI Python SDK, your chosen search/news provider, Alembic/psycopg.

## Work packages (in order — commit each)
1. **WP2A.1 Skeleton + contract + auth + fake mode** — pydantic contract models exactly per `api-contract.md`, OpenAPI export, HMAC/bearer/skew auth, error envelope, health/readiness/capabilities, `intel` schema + Alembic, fake mode with 4 fixture companies, `verify:all` + `docker-compose.yml` + CI job. **Merge this first; announce the contract is stable** so app work (2B) can start on the fake.
2. **WP2A.2 Fetch layer + connectors** — guardrails first (SSRF suite before any connector), then `website`, `web_search`, `news`, `jobs`; source cache; cassettes. *Exit:* SSRF suite green; live smoke on 3 public sites within budgets.
3. **WP2A.3 Extraction + LLM client** — deterministic extractors, structured LLM extraction with required `source_span`, `llm/client.py` with usage accounting, retry-once, quota mapping, fake LLM. *Exit:* goldens pass; no field without a span found in the text.
4. **WP2A.4 Evidence Validator** — all seven checks, confidence formula, standalone endpoint, adversarial corpus. *Exit:* **0 false-verified**; every unverified verdict has reasons.
5. **WP2A.5 Agents + pipeline** — Research (company), Signal, Qualification (+ `/v1/score`), Outreach Research; pipeline with planner, budgets, trace, usage, idempotency, cancel, SSE (optional). *Exit:* fixture runs satisfy all contract invariants; budget exhaustion ⇒ graceful partial.
6. **WP2A.6 Hardening** — injection fixtures, load test (50 concurrent), structured logs, staging deploy per checklist, docs updated with deviations, eval report.

## Do NOT
- Add a sixth agent, a `public_profiles`/`reddit` connector, headless browser rendering, or email-address inference.
- Give the service credentials to product tables, or any way to send email.
- Let any agent fetch URLs itself, or accept a source URL that the engine didn't fetch.
- Let the LLM produce scores, weights, or verification verdicts without the deterministic checks.
- Store anything workspace-identifying in the source cache; expose the service publicly; log secrets/keys/full page bodies.
- Bypass robots.txt, solve CAPTCHAs, rotate proxies to evade blocks, or spoof user agents.
- Build discovery/people search (Phase 8) or touch the Next.js app beyond `verify:all`/compose.

## Verification
`make verify` (ruff, mypy strict, pytest, contract) · SSRF suite · validator adversarial suite (**0 false-verified**) · scoring property tests · contract invariants on every fixture · OpenAPI drift check · load test · `make eval` report (unsupported-claim rate in stored output = 0; injection fixtures inert) · staging: run the smoke against 3 real domains and inspect trace/usage · root `npm run verify:all`.

## STOP and ask if
- No search/news provider decision exists and you'd have to pick one with cost/terms implications.
- The validator can't reach 0 false-verified without an unacceptable false-unverified rate (share the confusion table).
- Legal/ToS doubts arise about a target source.
- Hosting choice (D-12) blocks staging.

## Report
Format in `docs/missions/README.md`, plus: eval tables (validator, extraction, agents), the invariants checklist result, and per-run cost/latency stats from the smoke runs.
