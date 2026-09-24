# 02 — Architecture

Keep: Next.js 16 App Router + Neon Postgres + NextAuth + Resend + OpenAI (gpt-4o-mini). Add: a durable job layer, a tool-based agent layer, a structured-output validation layer, and a **Python Intelligence Engine** (separate service, decision D-11) that investigates the world.

> **Next.js runs the business/product. Python investigates the world.**

## System overview

```
                     ┌────────────────────────────── Next.js app (product) ──────────────────────────────┐
 Browser / Extension │  UI · server actions · route handlers · tenancy · approvals · credits · campaigns  │
        ───────────► │  Gennie Orchestrator → Lead Agent · Campaign Agent · Inbox Agent                   │
                     │  jobs (Postgres queue) · email pipeline (Resend/Gmail) · persistence of research    │
                     └───────────────┬──────────────────────────────────────────────┬────────────────────┘
                                     │ signed HTTPS (private)                        │ SQL
                                     ▼                                               ▼
              ┌──────────────── Intelligence Engine (Python/FastAPI) ───────────┐   Neon Postgres
              │ sources → extraction → Research · Signal · Qualification ·       │   • product schema (Next only)
              │ Outreach Research → Evidence Validator → Scoring                 │   • `intel` schema (engine only:
              └──────────────────────────────────────────────────────────────────┘     runs, source cache)
                                     │ public web, search/news/jobs APIs, LLM
```

Hard boundaries:
- The **engine never writes product tables and never sends email**; its DB role only reaches the `intel` schema.
- **Next is the single writer** of leads/companies/signals/evidence/research and the only place that knows workspaces, users, credits and approvals.
- Communication is a **versioned, schema-validated contract** (`docs/intelligence-engine/api-contract.md`); each side has a fake of the other.

## Layering (Next.js side)

```
app/                     UI (server components + client islands) and thin route handlers
lib/actions/*            "use server" mutations — auth + validation + call domain services
lib/api/*                (new) response envelope, AppError, request parsing helpers
lib/domain/<area>/*      (new) business logic — pure-ish services, no Next imports
lib/agent/*              (new) orchestrator, tool registry, Lead/Campaign/Inbox agents, run recorder
lib/intelligence/*       (new) typed client for the engine: client.ts, generated types, zod mirrors, persist.ts, fake.ts
lib/ai/*                 LLM client, prompt builders, output schemas (zod) — for Next-side AI (copy, replies, planning)
lib/jobs/*               (new) queue: enqueue, claim, handlers, worker loop
lib/providers/*          (new) mail providers (Resend, Gmail) — data acquisition lives in the engine
lib/db/*                 sql client, migrations runner, query helpers
services/intelligence/   (new) PYTHON engine — see docs/intelligence-engine/
```

Rules of the road:

- **Server actions and route handlers stay thin**: authenticate → parse/validate → call a `lib/domain` service → return the envelope. Existing files in `lib/actions/` get their logic moved into `lib/domain` *as each phase touches them* — no big-bang refactor.
- **Domain services take an explicit `ctx: { workspaceId, userId, actor }`** so the same code runs from a user action, a job, or an agent tool with the same tenancy guarantees.
- **Nothing in `lib/agent` talks to SQL directly** — it calls domain services. This is how rule 15 ("AI cannot directly execute arbitrary database mutations") is enforced structurally.
- **No research/scraping/scoring logic in TypeScript.** It lives in the engine (rule 4: no duplicate functionality). Next only builds requests, validates responses, and persists.

## Tenancy

- The boundary is `workspace_id`, resolved via `requireWorkspace()/requireRole()` for users, `extensionAuthFromRequest` for the extension, and a `JobContext` for workers/agents.
- Every query on a workspace-owned table includes `workspace_id = ${ctx.workspaceId}`. Lookups by id alone are bugs.
- Jobs and agent runs **persist `workspace_id` and `user_id`** and re-derive context from those, never from ambient session state.
- **The engine is workspace-agnostic by construction:** it receives ICP/positioning as *data* in each request, holds no per-workspace state (only a public-web source cache), and returns results. Cross-workspace leakage through the engine is impossible because it has nothing to leak.
- Phase 0 adds an automated isolation test (two workspaces) for every list/get/mutate action.

## Standard response & error contract

```ts
type Ok<T>  = { ok: true;  data: T }
type Err    = { ok: false; error: { code: ErrorCode; message: string; details?: unknown; retryable?: boolean } }
// ErrorCode: UNAUTHENTICATED | FORBIDDEN | NOT_FOUND | VALIDATION | CONFLICT
//          | RATE_LIMITED | QUOTA_EXCEEDED | PROVIDER_ERROR | UNAVAILABLE | TIMEOUT | INTERNAL
```

- Route handlers return `Response.json(envelope, { status })`. The engine uses the **same envelope**.
- Server actions used by forms may keep returning plain data for now; any **new** action returns the envelope; existing ones migrate when touched.
- `AppError(code, message, details?)` thrown in domain code, translated once at the edge. Unknown errors → `INTERNAL` + log with request id; never leak stack/SQL.

## Validation

**zod** (Next) and **pydantic v2** (engine). One schema per API input and per AI output, colocated with the code that uses it. The provider's native structured-output mode (OpenAI `json_schema`, `strict: true`) is a *hint*, not trusted: every AI response is parsed with the schema before anything is written (rule 8). Failure → one retry with the validation error appended → else the job/tool fails with `VALIDATION`, nothing is written. Engine responses are **re-validated in Next** with zod mirrors (generated from OpenAPI + contract tests) before persistence.

## Durable jobs (PLAN §32, §41)

Today: an in-request batch of 25 behind a cron URL. Target: a **Postgres-backed queue** (recommended default — D-01) behind a small interface so the runtime can be swapped later.

```
jobs
  id, workspace_id, user_id, type, payload jsonb, state jsonb,   -- state: e.g. engine run_id while polling
  status  queued | running | succeeded | failed | dead | canceled,
  idempotency_key text  (unique with type),
  attempts int, max_attempts int, run_at timestamptz,
  locked_by text, locked_until timestamptz,      -- lease
  result jsonb, error text, agent_run_id, created_at, finished_at
```

- **Enqueue**: `enqueue(type, payload, { workspaceId, userId, idempotencyKey, runAt })` — `ON CONFLICT (type, idempotency_key) DO NOTHING`.
- **Claim** (single statement, works over Neon's HTTP driver): `UPDATE jobs SET status='running', locked_by=$w, locked_until=now()+interval '5 min', attempts=attempts+1 WHERE id IN (SELECT id FROM jobs WHERE status='queued' AND run_at<=now() ORDER BY run_at LIMIT $n FOR UPDATE SKIP LOCKED) RETURNING *`
- **Lease recovery**: stuck `running` past `locked_until` → re-queued (or `dead` after `max_attempts`).
- **Retry**: exponential backoff + jitter; provider 429/5xx retry; validation/permanent → `dead`.
- **"Await external" pattern** (engine runs): a handler that has submitted an engine run re-queues itself with `run_at = now()+5s` and the engine `run_id` in `state`, until the run is terminal. Survives restarts of either side; resubmission after an engine restart uses the same idempotency key.
- **Cancel/pause**: `status='canceled'` checked between units; campaigns pause by flipping campaign status; canceling a research job also calls engine `POST /v1/runs/{id}/cancel`.
- **Handlers are idempotent by construction** (natural keys, `ON CONFLICT`).
- **Worker**: `POST /api/jobs/tick` (Bearer `CRON_SECRET`) drains up to N jobs within a time budget; `scripts/scheduler.mjs` calls it every minute; optional always-on `scripts/worker.mjs`. `/api/cron/send-campaigns` becomes a thin alias in Phase 5.
- **Job types** (PLAN §41): `lead_enrichment`, `company_research`, `lead_research`, `lead_scoring`, `personalization`, `campaign_send`, `campaign_followup`, `email_sync`, `reply_classification`, `analytics_aggregation`, `agent_run`, `agent_step`.
- **Observability**: every attempt logs `job_id, type, workspace_id, duration_ms, status, attempts, error`.

## Intelligence Engine (Python)

Full design: [`intelligence-engine/`](intelligence-engine/README.md). In this architecture it provides:

| Capability | Engine layer |
|---|---|
| Fetch/search public information within budgets | Source connectors + guarded fetch (SSRF, robots, rate limits) |
| Turn documents into candidate facts with source spans | Extraction (deterministic first, LLM-structured second) |
| Company profile, signals, qualification inputs, outreach strategy | Research · Signal · Qualification · Outreach Research agents (5 agents total incl. validator) |
| **Decide what is verified** | **Evidence Validator** (URL-fetched-by-us, snippet-verbatim, entity match, claim↔snippet entailment, recency, source tier, corroboration) |
| ICP/Intent numbers | Deterministic scoring (single implementation) |

Contract highlights (`intelligence-engine/api-contract.md`): async `POST /v1/runs` + poll, hard budgets with graceful partials, idempotency keys, sync `POST /v1/score`, `GET /v1/capabilities`, run-local ids mapped to DB ids by Next, `trace[]` → `agent_run_steps`, `usage[]` → `usage_records`.

Failure semantics: engine unavailable ⇒ jobs retry, UI shows "Research engine unavailable"; **Next never substitutes an LLM guess**. Quota errors surface as `QUOTA_EXCEEDED`.

## Agent layer

Full specs: [`product-agents/`](product-agents/README.md) (Next-side) and [`intelligence-engine/agents/`](intelligence-engine/agents/) (Python-side).

```
Command Center prompt
   └─► Planner (LLM → zod-validated Plan, aware of engine /capabilities) ──► user approves
         └─► Orchestrator (deterministic state machine, persisted in agent_runs/agent_run_steps)
               ├─ Lead Agent      → tools: search_companies, search_people, get_company, get_person, enrich_lead,
               │                     research_company, find_buying_signals, score_lead   ── delegate to ──►  Intelligence Engine
               ├─ Campaign Agent  → generate_email, create_campaign, preview_campaign, schedule_campaign (approval), pause_campaign
               └─ Inbox Agent     → classify_reply, draft_reply        (send_reply is human-only)

Intelligence Engine agents (Python): Research · Signal · Qualification · Outreach Research · Evidence Validator
```

- **Tools are the only way an agent mutates state.** Each Next-side tool = `{ name, inputSchema (zod), outputSchema (zod), estimateCost, requiresApproval, run(ctx, input) }`, workspace-scoped through `ctx`, calling a domain service.
- **The LLM proposes, the app disposes:** structured JSON out; app code validates; app code writes.
- **Fan-out via jobs:** orchestrator enqueues per-lead child jobs (`company_research`, `lead_scoring`, `personalization`); a 100-lead run survives restarts.
- **Approval gates are tool-level:** `schedule_campaign` requires an approved `approvals` row; `send_reply` isn't exposed to any LLM path.
- **Every tool call** appends `agent_run_steps` (tool, input hash, output summary, duration, tokens, credits, status, error); engine `trace[]` is imported into the same table.

## External data providers

Data acquisition (search, news, jobs, licensed people/company data — D-03) is implemented as **engine connectors**, behind the engine's `capabilities`. Next never talks to those providers. Next-side provider adapters exist only for **mail** (`MailProvider`: Resend now, Gmail in Phase 6; `FakeMailProvider` for tests).

## Evidence pipeline (defense in depth)

1. **Engine:** claims must carry evidence refs; the Evidence Validator verifies them (URL must have been fetched by the engine, snippet verbatim in captured text, entity match, entailment, recency, tier, corroboration); only verified data feeds scoring and outreach narratives.
2. **Next persistence:** re-validates the payload (zod), re-checks invariants (ids resolve, source URLs present, unverified never used in scores/outreach), **quarantines** violations.
3. **Generation (Phase 3):** `buildContext()` passes only verified evidence to the email model; a post-generation validator maps every personalized claim to an evidence id.
4. **UI:** verified claims show sources; unverified items live in a separate "not used" group with reasons.

A claim without evidence is never a fact anywhere in the system.

## Email pipeline (target)

```
Campaign(approved) ─► scheduler ─► campaign_leads.next_action_at ─► job:campaign_send
   ─► precheck (DNC, unsub, cooldown, bounce, daily/total limit, mailbox status) ─► MailProvider.send
   ─► messages(out) + campaign_sends.status ─► provider webhooks (delivered/bounced/complained/opened)
   ─► inbound reply ─► messages(in) ─► inbox_threads ─► job:reply_classification ─► stop sequence for that lead
```

The existing precheck logic in `lib/campaigns/dispatch.ts` and `lib/compliance.ts` is retained and moved into the `campaign_send` handler.

## LLM usage

- **Next:** single entry `lib/ai/client.ts` (**exists**: provider-neutral `generateJson`/`generateText` over an `LlmProvider` adapter — `lib/ai/providers/openai.ts`, model from `OPENAI_MODEL`, default `gpt-4o-mini`): structured output, token accounting, `usage_record`, per-workspace limits, quota mapping, mockable. Used for: planner, personalization copy, reply classification/drafts, AI filter builder.
- **Engine:** single entry `llm/client.py` with the same guarantees; returns `usage[]` to Next (Next writes `usage_records` — single writer).
- Model choice per task via config (cheap for classification/normalization/entailment, stronger for planning/personalization). Provider swappable (D-02).

## Security

- **Service-to-service:** engine is private-network only; requests carry bearer token + HMAC(timestamp.body) with 5-minute skew, two rotating secrets; engine DB role limited to `intel`.
- **Secrets:** `lib/crypto.ts` (AES-256-GCM) for stored provider credentials (mailbox OAuth tokens); engine keys via env/secret manager only.
- **Webhooks:** signature-verified (Resend); inbound webhooks idempotent on provider event id.
- **Extension & API tokens:** workspace-scoped; hashed at rest (Phase 0).
- **Cron/worker endpoints** require `CRON_SECRET` (constant-time compare).
- **Untrusted content:** fetched pages, scraped text and inbound emails are always passed to LLMs as delimited data; outputs are schema-validated; no tool path exists from content to action.
- **PII:** lead data workspace-scoped; deleting a lead cascades; the engine's cache stores only public content; export/delete before beta (Phase 11).

## Non-goals (architecture)

No message broker, no Temporal in V1 (unless D-01 flips), no third service beyond the engine, no engine access to product data. **Topology: one Next.js app + one Python engine + one worker script + Postgres** (plus Resend/LLM/search providers).
