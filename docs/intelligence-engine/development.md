# Intelligence Engine — Development Guide

## Toolchain

| Concern | Choice |
|---|---|
| Runtime | Python 3.12 |
| Packaging | `uv` (`pyproject.toml` + committed `uv.lock`) — pin everything |
| Web | FastAPI + Uvicorn; pydantic v2 models as the contract |
| HTTP | httpx (async) |
| LLM | OpenAI Python SDK (`gpt-4o-mini` default, structured outputs via JSON schema / pydantic parsing) behind `llm/client.py` (provider-swappable; same D-02 decision as the app). Verify current SDK API before coding |
| DB | psycopg 3 (async, pooled) to the **`intel` schema only**. Migrations are plain numbered SQL (`migrations/*.sql`) applied by `scripts/migrate.py` with checksums (`intel.schema_migrations`) — Alembic was dropped: it would pull in SQLAlchemy for three tables |
| Lint/format | ruff (lint + format) |
| Types | mypy `--strict` (or pyright strict) — no untyped defs |
| Tests | pytest, pytest-asyncio, respx (HTTP mocking), hypothesis (scoring properties) |
| Logging | structlog JSON: `request_id, agent_run_id, job_id, workspace_id, run_id, stage, duration_ms` |
| Container | Docker (slim, non-root, read-only FS where possible) |

Commands (`Makefile`): `make dev` · `make verify` (ruff → mypy → pytest → contract) · `make openapi` · `make smoke DOMAIN=…` · `make eval` · `make fake` (serve deterministic fake engine).

Repo-level: root `npm run verify:all` runs the Next `verify` **and** `make -C services/intelligence verify` (added in Phase 2A). CI runs both plus the contract job.

## Conventions

- **Layering:** `api → pipeline → {sources, extraction, agents, evidence, scoring}`; agents/scoring never import `sources`; `sources` never import `agents`. Import-linter (or ruff rule) enforces it.
- **No global mutable state.** Per-run `RunContext` (budgets, trace, usage, doc set).
- **Everything typed and validated:** requests/responses/LLM outputs are pydantic models; `model_validate` on every LLM JSON; retry once with the validation error appended, then fail visibly.
- **LLM calls only through `llm/client.py`** (structured output, retries, timeouts, token+cost accounting into `usage[]`, quota mapping to `QUOTA_EXCEEDED`, fake mode for tests). No raw SDK use elsewhere.
- **Prompts are versioned constants** in `llm/prompts/<agent>/v<N>.py`, each with a matching eval; bumping a version requires eval results in the PR.
- **Budgets are checked before every external call** (`ctx.budget.spend(...)` raises `BudgetExhausted` → graceful partial).
- **Errors:** typed exceptions mapped once to the contract error codes; never leak stack traces or provider keys.
- **Secrets:** env only (`pydantic-settings`), never logged; `.env.example` lists all variables.
- **Config flags:** connectors enabled via config; `capabilities` reflects reality.

## Environment variables

`INTELLIGENCE_SERVICE_TOKEN` / `INTELLIGENCE_SIGNING_SECRET(S)` · `INTEL_DATABASE_URL` (role limited to `intel` schema) · `OPENAI_API_KEY`, `OPENAI_MODEL` (per-task overrides optional) · search/news/jobs provider keys (per D-03) · `FETCH_USER_AGENT`, `FETCH_MAX_BYTES`, `FETCH_HOST_RPS` · `LOG_LEVEL` · `ENGINE_FAKE_MODE`. Next side: `INTELLIGENCE_URL`, same signing secret(s).

## Testing strategy

| Layer | Tests |
|---|---|
| Fetch guardrails | SSRF suite, robots, redirect chains, size/type limits, per-host limiter |
| Collectors | Cassette-backed; pages from `fixtures/sites/` incl. hostile pages |
| Extraction | Golden outputs; `source_span` must exist in text |
| Agents | Fake LLM with scripted outputs: valid, invalid JSON, hallucinated claim, injection attempt |
| **Evidence Validator** | Adversarial suite (see its doc) — target **0 false-verified** |
| Scoring | Table + hypothesis property tests (determinism, monotonic, unverified-has-no-effect) |
| API | Auth/HMAC/skew, idempotency, budgets, cancel, error envelope, capabilities |
| Contract | OpenAPI drift check; Next zod schemas vs engine fixtures; invariants from `api-contract.md` on every fixture result |
| Evals (manual/nightly, real LLM, real fetch of a fixed public-safe list) | Unsupported-claim rate, verified-precision, source-URL validity, injection resistance, cost per run, p50/p95 latency |
| Load | 50 concurrent runs with budgets: no host-rate violations, no memory growth, correct partials |

No live network or LLM in the default CI path.

## Local development

1. `cd services/intelligence && uv sync && cp .env.example .env`
2. `make fake` for a deterministic fake engine (no keys) — enough to develop the Next.js side.
3. `make dev` for the real engine against your keys; set `INTELLIGENCE_URL=http://localhost:8000` in the app's `.env.local`.
4. `docker compose up` (root) starts Next + engine + Postgres for full-stack local runs (added in Phase 2A).

## Deployment checklist (details pending D-12)

Private networking only · TLS between services · secrets manager · min 2 replicas in prod · readiness gates traffic · autoscale on CPU/queue lag · outbound egress allow-listed where the host supports it · resource limits per container · log shipping with `run_id` correlation · alerts: error rate, p95 run duration, LLM/search quota errors, fetch-block rate, budget-exhaustion rate · backup/retention for `intel` schema · runbook entry in `docs/runbook.md`.

## As built (Phase 2A)

- **Commands:** `make verify` (ruff → ruff format --check → import-linter → mypy strict → pytest → OpenAPI drift + contract tests), `make eval` (adversarial validator corpus, prints metrics), `make smoke DOMAIN=example.com NAME="Example"` (budget-limited **real** run: real fetch + OpenAI, prints trace/cost), `make fake`, `make migrate`, `make openapi`. Root: `npm run verify:engine`, `npm run verify:all`.
- **Tests (185 default + 6 opt-in):** fetch/SSRF guardrails, collectors (fake internet via `httpx.MockTransport`), extraction, strict-schema converter, LLM client, **Evidence Validator adversarial suites**, scoring (table + hypothesis properties), agents + full pipeline end-to-end with a scripted LLM, API (HMAC, idempotency, cancel, restart, SSE), contract invariants + OpenAPI drift, architectural boundary tests, 50-concurrent-run load test. Opt-in `-m pg` (needs `INTEL_TEST_DATABASE_URL`, a disposable Postgres): migrations, idempotent runs, cache, cross-connection host limiter, **engine-restart mid-run recovery**.
- **Injectable clock** (`app/clock.py`): recency windows and score decay read the clock through one function; tests freeze it so fixture dates never rot.
- **Docker:** `services/intelligence/Dockerfile` (multi-stage, non-root, healthcheck); `docker-compose.yml` at the repo root (`engine-fake` for developing the Next side; `--profile real` adds Postgres + migration + engine). Verified: signed requests over real HTTP, runs persisted in Postgres, correlation ids (`agent_run_id`, `request_id`) in the JSON logs.
- **Egress:** the SSRF guard is application-level. In production also restrict the container's outbound network to the public internet (block RFC1918/link-local/metadata at the network layer).
