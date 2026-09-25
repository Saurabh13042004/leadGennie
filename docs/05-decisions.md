# 05 — Decisions

Open questions that change what gets built. Each has a **recommendation** so work isn't blocked, but items marked **BLOCKING** need the owner's explicit confirmation before the named phase starts. Record the outcome in the "Decision" line and don't relitigate it in later phases.

---

## D-01 — Job runtime: Postgres queue vs Temporal / Inngest / Trigger.dev
**Blocking for:** Phase 5 (a minimal enqueue helper is needed in Phase 2).
**Context:** Earlier PRD notes recommended Temporal. PLAN.md says "a durable job architecture appropriate to the existing project". The app is Next.js + Neon (HTTP driver), with an always-on `scripts/scheduler.mjs` already in use. Vercel-style serverless can't run long workers.
**Options:**
- **A. Postgres-backed queue** (`jobs` table, `SKIP LOCKED` claim, leases, backoff) + tick endpoint + optional worker script. *No new infra or vendor; ~2–3 days; fits scale of 1–10 person teams.*
- B. Inngest / Trigger.dev (hosted durable functions). *Less code, real dashboards, but a new vendor + pricing + local-dev story.*
- C. Temporal. *Strongest guarantees; heavy ops burden; overkill for V1.*
**Recommendation:** **A**, behind an `enqueue()/handler` interface so B is a drop-in later.
**Decision: DECIDED — A, Postgres queue (owner, 2026-09-25).** Already built in Phase 2B (`lib/jobs/*`) and now carries the email engine (Phase 5). Confirmed when the owner asked where the background workers should live and then said "ok start phase 5": the queue, schedulers and workers stay in the Next.js app (`POST /api/jobs/tick` + `npm run worker`); the Python engine only investigates the world and never sends. The `enqueue()`/handler-registry interface keeps B a drop-in later.

## D-02 — LLM provider, billing tier, and model routing
**Status: DECIDED (owner, 2026-09-24): OpenAI `gpt-4o-mini`.** Migrated off Gemini; a stronger model isn't needed. The Gemini free tier (20 requests/day) is no longer a blocker.
**Implemented (Next.js side):** all LLM calls go through `lib/ai/client.ts` (`generateJson`, `generateText`, `MODEL_NAME`) over an `LlmProvider` adapter (`lib/ai/providers/openai.ts`); strict JSON-schema structured outputs; `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default `gpt-4o-mini` since 2026-09-25 — owner change from `gpt-4o-mini`; the Phase 2/3 live evals in the changelog were measured on `gpt-4o-mini` and have not been re-run); errors mapped to `QUOTA_EXCEEDED` / `RATE_LIMITED` / `NOT_CONFIGURED` / `PROVIDER_ERROR`. `@google/genai` removed.
**Still to do:** the Python engine's `llm/client.py` uses the OpenAI Python SDK with the same rules (structured output, usage accounting, quota mapping); cheap tasks (normalization, entailment, classification) may later route to a smaller model via per-task env overrides — only if evals show it's worth it.
**Operational:** set a monthly spend limit on the OpenAI key; budgets per engine run (`max_llm_calls`, `max_cost_usd`) cap research cost. Revoke the old Gemini key that was once hardcoded in the extension (no longer used).
**Decision:** _decided_

## D-03 — Data sources for the Intelligence Engine (search, news, jobs, people/company data)
**Blocking for:** Phase 2A (`web_search` + `news` provider) and Phase 8 (`public_data`: `search_companies`/`search_people`).
**Context:** PLAN forbids building a proprietary lead database. All acquisition now lives in the Python engine as *connectors* (see `intelligence-engine/sources.md`). Two separate choices:
1. **Search + news provider for Phase 2A** — a web-search API (e.g. Brave/Serper/Tavily/Google-grounded search) and a news source (news-search API or RSS). Needs: acceptable terms for programmatic use, cost per query, result quality, ability to return source URLs/snippets. Verify current API terms and pricing; don't assume.
2. **People/company data provider for Phase 8** (Apollo, People Data Labs, etc.) — licensed data behind `public_data`.
**Recommendation:** **Hybrid, staged.** 2A uses first-party websites (fetched directly) + job pages + one search provider + one news source, on leads the user already has. Phase 8 adds one licensed people/company provider; until then `search_companies/search_people` are absent from `/v1/capabilities` and the planner omits discovery steps (the system never fabricates prospects). `public_profiles` (LinkedIn etc.) scraping stays **off the table**; `reddit` deferred.
**Decision:** _pending_ (2A blocker: pick the search/news provider)

## D-04 — "Connect email": Resend sending domain vs user's own mailbox (Gmail/Outlook OAuth)
**Blocking for:** Phase 6 (reply ingestion) — and shapes Phase 5.
**Context:** Today: Resend with verified domains + mailboxes (from addresses). Resend gives outbound + bounce/complaint webhooks, but **replies need a receiving path** and a founder's real inbox is where replies land. V1's definition requires "connect email" and "receive a reply".
**Options:**
- A. **Gmail/Microsoft OAuth**: send *and* read replies from the user's real mailbox (proper threading, best deliverability for small teams, no DNS). Cost: OAuth verification (Google restricted-scope review for reading mail), token storage (use `lib/crypto.ts`), polling/push sync.
- B. **Resend + inbound routing** on a reply-to subdomain, forwarding to the app. Cost: DNS/MX setup; verify Resend's current inbound capabilities before committing.
- C. IMAP polling. Universal but clunky.
**Recommendation:** Keep Resend as the outbound provider for Phase 5 (already works, approval-gated). For replies, **start with A (Gmail first)** as `MailProvider` implementation #2 in Phase 6, since it satisfies "connect email → send → receive reply" end-to-end for the target user; start Google OAuth verification early because it has lead time. Fall back to B if OAuth review blocks the beta.
**Decision:** _decided (owner, 2026-09-26): option A for both Google **and** Microsoft, with Resend + verified domains kept as an advanced provider._ Built as a cross-phase migration ahead of Phase 6: OAuth connect/reconnect/disconnect, per-mailbox provider registry, Gmail + Graph send adapters, write-ahead at-most-once for providers with no idempotency key, normalised inbox types + reply detection. **Deviation from the recommendation:** it is not Gmail-first — Microsoft ships at the same time, and *reading* mail (the Google restricted scope) is deliberately not requested until the Inbox phase. Still open from this decision: Google verification of the sensitive `gmail.send` scope and, later, the restricted read scope (lead time — start now); option B stays the fallback if that blocks the beta. See [`mailboxes.md`](mailboxes.md).

## D-05 — LinkedIn automation vs PLAN §6 (out of scope for V1)
**Blocking for:** Phase 4 (channels in campaign builder) and Phase 7.
**Context:** The repo already sends real LinkedIn DMs through the extension (`DRY_RUN=false`, 8 rounds of live bug-fixing). PLAN explicitly excludes automated LinkedIn messaging from V1. Automating LinkedIn risks account restrictions for users.
**Recommendation:** **Keep the code, switch it off by default.** Add `FEATURE_LINKEDIN_AUTOMATION` (env, and later a per-workspace flag). With the flag off: `linkedin_dm` is not offered in the campaign builder, `/api/extension/queue` returns nothing, and the extension works as **capture-only** (add lead, research with Gennie). No deletion — it can return post-V1 as an opt-in.
**Decision:** _decided (owner, 2026-09-25): email-only builder, LinkedIn behind `FEATURE_LINKEDIN_AUTOMATION` (default off)._ Phase 4 delivered the builder side: the new builder is email-only; with the flag on, `/dashboard/campaigns/new` also offers the old multi-channel wizard (kept, not deleted). **Extension side done in Phase 7 (2026-09-26):** with the flag off `/api/extension/queue` is always empty, queue reports / `personalize` / `pick-element` are refused, no `automation` scope is issued, and the extension's send code is dead-ended (server flag + scope + optional `debugger` permission) but retained; `DRY_RUN` defaults to true. Existing campaigns with LinkedIn steps are untouched (they simply have nothing pulling them).

## D-06 — What happens to features outside V1 (Deals, Tasks, Agentic Flows, HubSpot, Forms)
**Recommendation:** Hide, don't delete. Nav shows six items; a `NEXT_PUBLIC_SHOW_LEGACY_MODULES` flag (default off) exposes the rest for internal use. Forms/Unmatched Inbox move under Leads (inbound lead capture is on-loop). Agentic Flows stays reachable but the Campaign builder is the sequence editor. Tasks get one on-loop use later (follow-up when a reply is `INTERESTED`).
**Decision:** _decided (owner, 2026-09-25): hidden, not deleted_ — as already implemented in Phase 0. Saved Agentic Flows workflows can still seed a campaign's sequence (email steps only).

## D-07 — Sender positioning & ICP location
**Recommendation:** Move `users.pitch/company` to `workspaces.positioning/company_name` and add `workspaces.icp` (jsonb) with a guided onboarding step. Personalization and scoring both read workspace-level config. Dual-write → switch reads → drop old columns.
**Decision:** _recommendation adopted for Phase 1 (2026-09-24), as the Phase 1 mission allows — owner confirmation still welcome._ Delivered: `workspaces.positioning/company_name/icp/onboarding_dismissed_at` (migration `0007`), dual-write from `updateSenderPitch`, reads workspace-first with a `users.pitch/company` fallback. **Contract step (dropping the `users` columns) is intentionally NOT done** — a later release, after the fallback is confirmed unused.

## D-08 — Test database strategy
**Recommendation:** Vitest; integration tests run against a dedicated Neon **branch** (`DATABASE_URL_TEST`) that the suite migrates from empty and truncates per file. Refuse to run if `DATABASE_URL_TEST` equals `DATABASE_URL`. No test may touch a real workspace (replaces `scripts/test-campaign-compliance.mjs`).
**Decision:** _decided 2026-09-24 (Phase 0) — deviation from the recommendation:_ tests run against an **in-process Postgres (PGlite)** migrated from empty with the real migration files, with the Neon driver blocked (`tests/setup.ts`). It is hermetic, needs no credentials, and cannot reach real data. A Neon branch (`DATABASE_URL_TEST`) can be added later for driver-specific checks; it must never equal `DATABASE_URL`.

## D-09 — Credits currency & pricing shape
**Not blocking until Phase 10.** Recommendation: credits are an internal unit priced per operation (research lead 2, enrich 3, personalize 1 — from PLAN §37); real cost per unit is derived from `usage_records` (tokens + provider fees) during beta before any public pricing. Billing (Phase 11) starts only after real usage data exists.
**Decision:** _pending_

## D-11 — Python Intelligence Engine as a separate service
**Status: DECIDED (owner, 2026-09-24).** Research/enrichment/qualification runs in a Python service ("LeadGennie Intelligence Engine"); Next.js runs the product.
**Design consequences (recorded so they aren't relitigated):** monorepo location `services/intelligence/` · FastAPI + pydantic v2 · private + HMAC-authenticated · async runs with poll · **single writer** (engine never writes product tables, never sends email) · exactly five engine agents (Research, Signal, Qualification, Outreach Research, Evidence Validator) · collectors are deterministic and separate from agents · scoring single-implementation in Python · fake modes on both sides · `scrapers` are *connectors inside* the engine, not the engine itself. Full spec: [`intelligence-engine/`](intelligence-engine/README.md).
**Alternatives considered:** (A) all-TypeScript in Next — rejected: weaker ecosystem for extraction/NLP, research jobs would compete with the web app for compute; (B) Python as a library inside the Next worker — rejected: language mismatch, no clean scaling boundary.
**Decision:** _decided_

## D-12 — Engine hosting, DB access, and run durability (details of D-11)
**Implementation status (2026-09-24):** everything except the *host choice* is built and verified locally — poll pattern, `intel` schema + limited-role design, shared per-host limiter, run resume after a crash, Docker image (non-root, healthcheck). Only the staging deploy is blocked on picking a host.
**Blocking for:** Phase 2A staging deploy (development can proceed locally with compose).
**Open choices & recommendations:**
- **Host:** a container platform with private networking and long-request support (e.g. Fly.io, Railway, Cloud Run). Avoid pure serverless functions for the engine (long runs, background tasks). *Recommend:* same provider/region as the worker script, private network to Next; if the web app is on Vercel, put the engine + worker on a private-reachable host and restrict inbound with the HMAC + IP allow-list (Vercel egress IPs are not static — verify; consider a tunnel/proxy or making the *worker* (not Vercel functions) the only caller).
- **Who calls the engine:** only the always-on **job worker**, never browser or Vercel functions directly → keeps the engine unreachable from users and avoids serverless timeouts.
- **State:** run records + source cache in the same Neon database, **separate `intel` schema with its own role** (no new infra). Alternative Redis later if throughput demands.
- **Async pattern:** submit + poll from the Next job (recommended); signed callback optional later.
- **Scale:** ≥2 replicas in prod; shared DB-backed per-host rate limiter so replicas don't multiply crawl rate.
- **Secrets:** signing secret(s) + provider keys in the host's secret manager; rotation supported (two active secrets).
**Decision:** _pending_

## D-10 — Deployment target
**Context:** git history shows a `vercel.json` was added then removed and a cron fix; `scripts/scheduler.mjs` assumes an always-on process (pm2/Railway/Fly). Actual production topology isn't documented in the repo.
**Recommendation:** Document it in `docs/deployment.md` during Phase 0: web app host, worker host, env vars, cron/worker trigger, webhook URLs — and add the **engine host** (D-12) when Phase 2A starts. The queue design (D-01 A) works on any topology as long as *something* calls `/api/jobs/tick` every minute.
**Decision:** _partly decided 2026-09-24:_ topology documented in `docs/deployment.md` (what the code requires). The **actual hosts are still unknown** — fill in the table there.
