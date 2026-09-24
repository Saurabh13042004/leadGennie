# Intelligence Engine — API Contract (`/v1`)

Source of truth: pydantic models in `services/intelligence/app/contracts/`. FastAPI publishes OpenAPI; Next generates TS types from it (`npm run gen:intelligence`) and keeps **zod mirrors** in `lib/intelligence/schemas.ts`. Next re-validates every response with zod before persisting (rule 8) — the engine is a trusted *peer*, not a trusted *source*.

## Auth & headers

- Private network only. Every request: `Authorization: Bearer <INTELLIGENCE_SERVICE_TOKEN>`, plus `X-LG-Timestamp` and `X-LG-Signature` = hex HMAC-SHA256(secret, `timestamp + "." + METHOD + "." + path-with-query + "." + body`) — binding the method and path means a captured signature can't be replayed against another endpoint; reject skew > 5 min; constant-time compare. **Fails closed:** a deployment with no token/secret configured answers `503 UNAVAILABLE`, never serves unauthenticated. Token rotation supports two active secrets.
- Correlation headers (logging only, **not authorization**): `X-Request-Id`, `X-Agent-Run-Id`, `X-Job-Id`, `X-Workspace-Id`.
- Response header `X-Contract-Version: 1.x`.

## Endpoints

| Method & path | Purpose | Sync? |
|---|---|---|
| `POST /v1/runs` | Start a run (`company_research`, `lead_research`, `find_signals`, later `find_people`, `discover`) | 202 async |
| `GET /v1/runs/{run_id}` | Status, progress, result, trace, usage | sync |
| `GET /v1/runs/{run_id}/events` | Optional SSE progress stream | stream |
| `POST /v1/runs/{run_id}/cancel` | Cooperative cancel | sync |
| `POST /v1/score` | Pure ICP/Intent scoring from supplied data (no network, no LLM) | sync, fast |
| `POST /v1/evidence/validate` | Re-validate a small batch of claims against supplied/stored evidence | sync |
| `GET /v1/capabilities` | Which connectors/providers/tasks are live | sync |
| `GET /healthz`, `GET /readyz` | Liveness / readiness | sync |

## `POST /v1/runs`

```jsonc
{
  "idempotency_key": "company_research:ws42:acme.com:v3",   // same key ⇒ same run, never a duplicate
  "task": "lead_research",
  "input": {
    "company": { "name": "Acme", "domain": "acme.com", "linkedin_url": null, "location": "Bengaluru" },
    "lead":    { "name": "Sarah Chen", "title": "VP Sales", "linkedin_url": null },   // optional
    "questions": null,                        // null ⇒ default fixed question set
    "freshness_days": 14                       // reuse cached collection if newer
  },
  "context": {                                 // DATA only — engine has no notion of workspace identity
    "icp": { /* see scoring.md */ },
    "positioning": "We help outbound teams book more qualified meetings…",
    "offer_keywords": ["outbound", "SDR", "pipeline"],
    "locale": "en"
  },
  "budgets": { "max_seconds": 120, "max_pages": 25, "max_search_queries": 8, "max_llm_calls": 12, "max_cost_usd": 0.60 }
}
```
→ `202 { "ok": true, "data": { "run_id": "run_…", "status": "queued" } }`

Budgets are hard limits. On exhaustion the engine finishes gracefully with a **partial** result and `warnings: ["budget_exhausted:max_pages"]` — it never overruns silently.

## `GET /v1/runs/{id}`

```jsonc
{ "ok": true, "data": {
  "run_id": "…", "status": "queued|running|succeeded|failed|canceled",
  "progress": { "stage": "collecting|extracting|researching|signals|validating|scoring|outreach", "pct": 55 },
  "result": { /* Research Result, only when succeeded */ },
  "error": null,
  "trace": [ /* steps */ ], "usage": [ /* metered units */ ]
}}
```

## Research Result (`schema_version: "1"`)

```jsonc
{
  "schema_version": "1",
  "company": {
    "name": "Acme", "domain": "acme.com", "industry": "B2B SaaS", "employee_band": "51-200",
    "location": "Bengaluru, IN", "description": "…", "products": ["…"], "market": "…", "business_model": "…",
    "fields": [ { "field": "employee_band", "value": "51-200", "evidence_ids": ["ev_3"] } ]
  },
  "people": [ { "name": "Sarah Chen", "title": "VP Sales", "relevance": "owns sales development", "evidence_ids": ["ev_7"] } ],
  "signals": [
    { "id": "sg_1", "type": "HIRING", "title": "Hiring 8 SDRs", "description": "…", "detected_at": "2026-09-10",
      "confidence": 0.94, "verified": true, "evidence_ids": ["ev_1","ev_2"] }
  ],
  "evidence": [
    { "id": "ev_1", "claim": "Acme has 8 open SDR roles", "source_url": "https://acme.com/careers",
      "source_title": "Careers — Acme", "source_type": "careers", "snippet": "Sales Development Representative (8 openings)…",
      "content_hash": "sha256:…", "captured_at": "2026-09-24T10:02:11Z",
      "verification": { "verified": true, "confidence": 0.94, "method": ["url_fetched","snippet_present","entity_match","entailment","recency"], "checked_at": "…", "notes": [] } }
  ],
  "icp":    { "score": 91, "confidence": 0.82, "breakdown": [ { "criterion": "employee_range", "status": "met", "weight": 20, "points": 20, "value_found": "51-200", "evidence_ids": ["ev_3"] } ] },
  "intent": { "score": 87, "breakdown": [ { "signal_id": "sg_1", "weight": 20, "confidence": 0.94, "recency_factor": 0.95, "points": 17.9 } ] },
  "outreach": {
    "insufficient_evidence": false,
    "why_contact": "…", "why_now": "…", "why_person": "…", "potential_problem": "… (hypothesis)",
    "recommended_angle": "…", "evidence_ids": ["ev_1","ev_2","ev_7"]
  },
  "unknowns": ["funding history"],
  "warnings": []
}
```

**Invariants (contract tests enforce them on every fixture):**
1. Every `evidence_ids` reference resolves within `evidence[]`.
2. Every `source_url` in `evidence[]` was fetched by the engine (present in the run's document set).
3. `signals[].verified == true` ⇒ each referenced evidence has `verification.verified == true`.
4. `icp`, `intent` and `outreach` are computed **only from verified** evidence/signals.
5. Unverified signals/claims appear only under `signals[]` with `verified:false` (for UI transparency) — never in `outreach`, never in scoring.
6. IDs are run-local (`ev_n`, `sg_n`); Next maps them to database ids on persist.

## Errors

Same envelope as the Next app: `{ "ok": false, "error": { "code", "message", "details" } }`.
Codes: `VALIDATION`, `UNAUTHENTICATED`, `NOT_FOUND`, `RATE_LIMITED`, `QUOTA_EXCEEDED` (LLM/search provider quota), `PROVIDER_ERROR`, `BUDGET_EXCEEDED` (only when nothing usable was produced), `TIMEOUT`, `UNAVAILABLE` (no connector configured for the task), `INTERNAL`. Retryability is explicit: `error.retryable: boolean`.

## Idempotency, durability, retention

- `idempotency_key` unique per task; replays return the same `run_id` and (if finished) the same result.
- Run records and results live in `intel.runs` for 30 days, then purged. Source cache (`intel.source_cache`, public content only) TTL-driven.
- **Engine restart mid-run:** the run is marked `failed(retryable)` or resumed from the cache; Next's job lease/backoff resubmits with the *same key* — cached collection makes the retry cheap. No duplicated side-effects exist because the engine has none.

## Next.js integration pattern

`company_research` / `lead_research` job handler (Phase 2B):
1. Build input/context from DB (ICP, positioning, company/lead) — the *only* place workspace data is selected for the engine.
2. `POST /v1/runs` with a deterministic idempotency key (`task:workspace:entity:version`).
3. **Poll** (`GET /v1/runs/{id}`) by re-scheduling the job (`run_at = now + 5s`, run id kept in job state) until terminal — no inbound webhook needed, survives Next restarts. (Optional signed callback later.)
4. On success: validate with zod → `persist.ts` (single transaction via domain services: `companies` fields, `signals`, `evidence`, `lead_research`, scores) → append `agent_run_steps` from `trace`, `usage_records` from `usage`.
5. Failures: retryable errors back off; `QUOTA_EXCEEDED` surfaces to the user; validation failure ⇒ job `dead` with the engine's `run_id` for debugging.

## Versioning & compatibility

- Additive changes within `/v1` (new optional fields); breaking changes → `/v2` served in parallel until Next migrates.
- CI job `contract`: (a) regenerate OpenAPI, fail on un-committed drift; (b) run Next's zod schemas against the engine's golden fixtures; (c) run the engine against Next's example requests.
- `FakeIntelligenceClient` (TS) and a `--fake` mode of the engine (deterministic canned results, no network/LLM) let each side develop and test independently.
