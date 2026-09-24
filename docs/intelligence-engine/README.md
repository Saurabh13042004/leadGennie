# LeadGennie Intelligence Engine (Python)

> **Next.js runs the business/product. Python investigates the world.**

The Intelligence Engine is a Python service that gathers public information about companies and people, reasons over it with a small set of specialized agents, **verifies every claim against captured evidence**, scores fit and intent, and returns a structured Research Result. It is *not* "the scraper service" — collection is one layer of five.

Decision record: **D-11** (decided) and **D-12** (open details) in [`../05-decisions.md`](../05-decisions.md).

## Responsibilities

| Engine owns | Next.js app owns |
|---|---|
| Source connectors (search, websites, news, jobs, public data) and the guarded fetch layer | Users, workspaces, RBAC, billing, credits, approvals |
| Extraction (company / person / jobs / events) | Leads, companies, signals, evidence, research **persistence** (single writer of product tables) |
| Research, Signal, Qualification, Outreach-Research agents | Orchestrator, Lead / Campaign / Inbox agents, Command Center |
| **Evidence Validator** | Email personalization copy (Prompt Library), campaigns, sending, inbox |
| Deterministic ICP + Intent scoring | Tenancy checks, job queue, usage/credit ledger |
| Source cache, run records (`intel` schema only) | Everything user-facing |

## Non-negotiable rules

1. **Collectors don't decide.** Connectors fetch; they never classify something as a signal or claim.
2. **Agents reason; they do not fetch or write.** They consume collected/extracted data and return structured output.
3. **Exactly five agents in V1:** Research, Signal, Qualification, Outreach Research, Evidence Validator. A sixth needs a written justification in `05-decisions.md`. Complexity lives in deterministic tools, not in more agents.
4. **Nothing unverified is presented as fact.** Every claim-bearing item carries evidence ids; the Evidence Validator gates what reaches scoring and outreach narratives. Unverified items are returned *flagged*, never merged into facts.
5. **The engine never writes product tables and never sends email.** Its database role can touch only the `intel` schema (run records, source cache). Product persistence goes through Next.js domain services which re-validate the payload with zod.
6. **The engine never trusts URLs from an LLM.** A source URL is valid only if the engine itself fetched it in this run (or its cache) — the validator enforces this.
7. **Scoring is deterministic code.** LLMs may extract attributes; they never emit a score.
8. **Tenancy by construction.** The engine is workspace-agnostic: it receives the ICP/positioning as *data* per request, returns results, and holds no cross-workspace state beyond a public-web source cache (contains only public content, keyed by URL).
9. **Everything is traced and metered.** Each run returns `trace[]` and `usage[]`; Next records them (`agent_run_steps`, `usage_records`).
10. **Fetched content is untrusted data** (prompt-injection defense): delimited in prompts, instructions inside it ignored, outputs schema-validated regardless.

## Architecture

```
                         Next.js  (Gennie Orchestrator → Lead Agent)
                                   │  HTTPS, signed, private network
                                   ▼
                    ┌─────────────────────────────┐
                    │  FastAPI  /v1/runs · /v1/score │
                    └──────────────┬──────────────┘
                                   ▼
                          Run pipeline (budgeted)
      ┌───────────────────────────────────────────────────────────┐
      │ 1 Search Planner      deterministic query templates (+LLM expand) │
      │ 2 Source Connectors   web_search · website · news · jobs · public_data │
      │ 3 Extraction          company · person · jobs · events (deterministic first, LLM-structured second) │
      │ 4 Agents              Research → Signal → Qualification(inputs) → Outreach Research │
      │ 5 Evidence Validator  claim → evidence → source → confidence → verified? │
      │ 6 Scoring             ICP · Intent (pure functions)          │
      └───────────────────────────────────────────────────────────┘
                                   ▼
                    Research Result  (contract: api-contract.md)
```

Company pipeline in order:

```
Company ─► Search Planner ─► [Website | News | Jobs | Web search] ─► Raw documents (captured, hashed)
        ─► Extraction ─► Company Research Agent ─► structured profile
        ─► Signal Agent ─► candidate signals
        ─► Evidence Validator ─► verified / unverified (with reasons)
        ─► Scoring (ICP + Intent, verified data only) ─► Qualification output
        ─► Outreach Research Agent (verified only) ─► why contact / why now / why person / angle
        ─► Evidence Validator again on narrative claims ─► Research Result
```

## What the user ultimately sees (drives the contract)

> **Sarah Chen — VP Sales, Acme** · **91 ICP fit**
> 🔥 **Why now:** hiring 8 SDRs, announced US expansion · **Why Sarah:** owns sales development · **Potential problem (hypothesis):** rapid SDR growth may strain pipeline efficiency · **Recommended approach:** lead with qualified pipeline per SDR · **Evidence:** 3 verified sources · **[Generate outreach]**

Users never see "Python + FastAPI + 5 agents + 12 scrapers" — only the answer to *why should I contact this person?* with sources.

## Repo layout (monorepo, decision D-11)

```
services/intelligence/
  pyproject.toml  uv.lock  Dockerfile  .env.example  Makefile
  app/
    main.py  config.py  auth.py  deps.py
    api/v1/            runs.py  score.py  validate.py  capabilities.py  health.py
    contracts/         pydantic v2 models (single source of truth → OpenAPI → TS types)
    pipeline/          planner.py  run.py  budgets.py          # orchestrates stages for a run
    sources/           base.py fetch.py web_search.py website.py news.py jobs.py public_data.py
                       # deferred (ToS review required): public_profiles.py reddit.py
    extraction/        company.py person.py jobs.py events.py
    agents/            research.py signal.py qualification.py outreach.py
    evidence/          validator.py matching.py confidence.py
    scoring/           icp.py intent.py
    llm/               client.py  prompts/  schemas/
    store/             intel schema access: runs, source_cache (Alembic migrations)
    telemetry/         logging.py  trace.py  usage.py
  tests/  unit/ contract/ evals/ fixtures/(recorded HTTP)
```

Next-side counterpart: `lib/intelligence/` — `client.ts` (typed HTTP client, signing, retries), `generated/` (types from OpenAPI), `schemas.ts` (zod mirrors), `persist.ts` (Research Result → `companies/signals/evidence/lead_research` via domain services), `fake.ts` (FakeIntelligenceClient for tests).

## Runtime & deployment (details pending D-12)

- Python 3.12, FastAPI + Uvicorn, pydantic v2, httpx (async), Docker image; stateless workers (state in `intel` schema).
- **Private**: not exposed to the internet; reachable only from the Next.js app and worker via private networking + HMAC-signed requests.
- Horizontal scale by replicas; per-host politeness limits are enforced in a shared limiter (DB-backed token buckets) so scaling doesn't multiply crawl rate.
- Health: `/healthz` (process), `/readyz` (DB + LLM key + at least one search source configured), `/v1/capabilities` (which connectors/providers are live → Next uses it to shape agent plans; nothing is assumed available).
- Degradation: if the engine is down, Next research jobs retry with backoff and the UI says "Research engine unavailable" — it never falls back to an LLM guess.

## Delivery by phase

| Phase | Engine capability shipped |
|---|---|
| **2A** | Service skeleton, contract, auth, `intel` schema, website + web_search + news + jobs connectors, fetch guardrails, Research/Signal/Qualification/Outreach agents, Evidence Validator, scoring, `POST /v1/runs` (`company_research`, `lead_research`), `POST /v1/score` |
| **2B** | Next-side client, persistence, UI (uses 2A) |
| 3 | Outreach output feeds personalization; optional `POST /v1/evidence/validate` for draft claim re-check |
| 8 | `find_people` / discovery connectors (`public_data`, provider adapters per D-03), People mode of Research Agent, `capabilities` drives plans |
| 10 | Engine `usage[]` → credits |
| 11 | Deploy, alerting, runbook, cost dashboards |
| Later (opt-in, legal review first) | `public_profiles`, `reddit`, headless rendering |

## Docs in this folder

| File | Contents |
|---|---|
| [`api-contract.md`](api-contract.md) | Endpoints, auth, idempotency, budgets, Research Result schema, errors, versioning |
| [`sources.md`](sources.md) | Connectors, fetch guardrails, extraction, search planner |
| [`scoring.md`](scoring.md) | ICP + Intent deterministic scoring |
| [`development.md`](development.md) | Toolchain, testing, evals, CI, local dev, deployment checklist |
| [`agents/research-agent.md`](agents/research-agent.md) | Company (and later People) research |
| [`agents/signal-agent.md`](agents/signal-agent.md) | Buying-signal detection |
| [`agents/qualification-agent.md`](agents/qualification-agent.md) | Fit qualification |
| [`agents/outreach-research-agent.md`](agents/outreach-research-agent.md) | Why contact / why now / angle |
| [`agents/evidence-validator.md`](agents/evidence-validator.md) | Claim verification gate |
