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
**Decision:** _pending_

## D-02 — LLM provider, billing tier, and model routing
**Blocking for:** Phase 2A/2B testing (free tier = 20 requests/day; a single 50-lead research run exceeds it — the engine makes several LLM calls per company: extraction, synthesis, signals, entailment, outreach).
**Recommendation:** Enable paid billing on the existing Gemini key now. Wrap all calls in a single client per runtime (`lib/ai/client.ts` in Next, `llm/client.py` in the engine — structured output + usage tracking + quota mapping) so the provider is swappable; route cheap tasks (classification, scoring) to a small/fast model and personalization/planning to a stronger one. Keep Gemini unless quality evals in Phase 3 say otherwise.
**Also:** rotate the Gemini key that was previously hardcoded in the extension.
**Decision:** _pending_

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
**Decision:** _pending_

## D-05 — LinkedIn automation vs PLAN §6 (out of scope for V1)
**Blocking for:** Phase 4 (channels in campaign builder) and Phase 7.
**Context:** The repo already sends real LinkedIn DMs through the extension (`DRY_RUN=false`, 8 rounds of live bug-fixing). PLAN explicitly excludes automated LinkedIn messaging from V1. Automating LinkedIn risks account restrictions for users.
**Recommendation:** **Keep the code, switch it off by default.** Add `FEATURE_LINKEDIN_AUTOMATION` (env, and later a per-workspace flag). With the flag off: `linkedin_dm` is not offered in the campaign builder, `/api/extension/queue` returns nothing, and the extension works as **capture-only** (add lead, research with Gennie). No deletion — it can return post-V1 as an opt-in.
**Decision:** _pending_ (this reverses a previously shipped behaviour — needs explicit confirmation)

## D-06 — What happens to features outside V1 (Deals, Tasks, Agentic Flows, HubSpot, Forms)
**Recommendation:** Hide, don't delete. Nav shows six items; a `NEXT_PUBLIC_SHOW_LEGACY_MODULES` flag (default off) exposes the rest for internal use. Forms/Unmatched Inbox move under Leads (inbound lead capture is on-loop). Agentic Flows stays reachable but the Campaign builder is the sequence editor. Tasks get one on-loop use later (follow-up when a reply is `INTERESTED`).
**Decision:** _pending_

## D-07 — Sender positioning & ICP location
**Recommendation:** Move `users.pitch/company` to `workspaces.positioning/company_name` and add `workspaces.icp` (jsonb) with a guided onboarding step. Personalization and scoring both read workspace-level config. Dual-write → switch reads → drop old columns.
**Decision:** _pending_

## D-08 — Test database strategy
**Recommendation:** Vitest; integration tests run against a dedicated Neon **branch** (`DATABASE_URL_TEST`) that the suite migrates from empty and truncates per file. Refuse to run if `DATABASE_URL_TEST` equals `DATABASE_URL`. No test may touch a real workspace (replaces `scripts/test-campaign-compliance.mjs`).
**Decision:** _pending_

## D-09 — Credits currency & pricing shape
**Not blocking until Phase 10.** Recommendation: credits are an internal unit priced per operation (research lead 2, enrich 3, personalize 1 — from PLAN §37); real cost per unit is derived from `usage_records` (tokens + provider fees) during beta before any public pricing. Billing (Phase 11) starts only after real usage data exists.
**Decision:** _pending_

## D-11 — Python Intelligence Engine as a separate service
**Status: DECIDED (owner, 2026-09-24).** Research/enrichment/qualification runs in a Python service ("LeadGennie Intelligence Engine"); Next.js runs the product.
**Design consequences (recorded so they aren't relitigated):** monorepo location `services/intelligence/` · FastAPI + pydantic v2 · private + HMAC-authenticated · async runs with poll · **single writer** (engine never writes product tables, never sends email) · exactly five engine agents (Research, Signal, Qualification, Outreach Research, Evidence Validator) · collectors are deterministic and separate from agents · scoring single-implementation in Python · fake modes on both sides · `scrapers` are *connectors inside* the engine, not the engine itself. Full spec: [`intelligence-engine/`](intelligence-engine/README.md).
**Alternatives considered:** (A) all-TypeScript in Next — rejected: weaker ecosystem for extraction/NLP, research jobs would compete with the web app for compute; (B) Python as a library inside the Next worker — rejected: language mismatch, no clean scaling boundary.
**Decision:** _decided_

## D-12 — Engine hosting, DB access, and run durability (details of D-11)
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
**Decision:** _pending_
