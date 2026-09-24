# Phase 5 — Email Execution Engine

## Goal
Reliable sending. No duplicate sends, no lost sends, no sends to suppressed recipients, and every delivery event recorded — without depending on a single long HTTP request.

```
Campaign → Scheduler → Job queue → Email worker → Provider → Delivery events → DB
```

## Starting point
`processEmailSends()` in `lib/campaigns/dispatch.ts` loads ≤25 due `campaign_sends` per invocation via `GET /api/cron/send-campaigns` (called by `scripts/scheduler.mjs` every 10 min). It prechecks DNC + cooldown, personalizes, sends via Resend (`sendCampaignEmail`), marks sent/failed. No retries, no leases, no idempotency key on the provider call, no per-mailbox/domain throttling beyond the campaign's numbers, no delivered/opened events, bounce/complaint webhook only suppresses. LinkedIn sends share the same route.

## Scope

### WP5.1 — Job runtime (D-01 → recommended Postgres queue)
Implement fully per `02-architecture.md`: `jobs` table hardened (indexes, `SKIP LOCKED` claim, leases, `max_attempts`, exponential backoff + jitter, `dead` state, cancel), `lib/jobs/{enqueue,claim,worker,registry}.ts`, `POST /api/jobs/tick` (`CRON_SECRET`, time-budgeted), `scripts/worker.mjs` optional always-on loop, tick frequency 1 min. Handler registry typed by job type with zod payloads. Structured logging for every attempt.
Migrate Phase 2's minimal jobs onto it; nothing else may bypass it for long-running work.

### WP5.2 — Scheduler & `campaign_send`
- **Scheduler job** (`campaign_followup`, runs every tick): selects `campaign_leads` where `status='active' and next_action_at <= now()` in running campaigns within the send window/limits → enqueues `campaign_send` with **idempotency key `send:{campaign_lead_id}:{step}`**.
- **`campaign_send` handler**: (1) re-load state; abort if campaign not `running` / lead not `active`; (2) **precheck** — DNC, unsubscribed, bounced/complained, cooldown, email_status invalid, mailbox `active` + domain verified, daily campaign limit, total limit, mailbox daily limit, per-domain hourly throttle, send window; a failed precheck **defers** (limits/window) or **stops** (suppression) with a recorded reason; (3) render final message (Phase 3 draft or template) + headers; (4) insert `messages(status=queued)` *before* calling the provider, with unique `(campaign_send_id)`; (5) call provider with provider-side idempotency key where supported; (6) update to `sent` with `provider_message_id`; (7) compute and set the next step's `next_action_at` (`delay_days` in the campaign timezone/send window) or complete the lead.
- **Crash-safety**: if the process dies between provider call and DB update, the lease expires and the retry finds `messages` row in `queued` with no provider id → **reconcile** by querying the provider by idempotency key/tags before resending (documented residual risk: at-most-once vs at-least-once tradeoff — choose *at-most-once* for sends; prefer a missed send that is flagged over a duplicate).

### WP5.3 — Rate limiting & warm-up guards
Limits enforced in a single `SendGate` module (unit-tested): campaign daily/total, mailbox daily (from `mailboxes.daily_limit`), workspace daily cap, per-recipient-domain throttle (e.g. max N/hour to one domain), jittered spacing between sends (no 25-at-once bursts), send-window/timezone. New mailboxes ramp: `effective_limit = min(daily_limit, ramp(days_since_created))`.

### WP5.4 — Provider abstraction & events
- `MailProvider` interface (`send`, `parseWebhook`, `capabilities`); `ResendProvider` = existing code moved behind it; `FakeMailProvider` for tests.
- Webhook `/api/webhooks/resend` extended (idempotent on Resend event id, signature-verified): `email.sent/delivered/delivery_delayed/bounced/complained/opened/clicked` → update `messages.status/timestamps`, write `message_events` (append-only). Hard bounce & complaint → suppress + stop lead's sequence + `bounced` stage (already partially there). Soft bounce → retry policy then stop.
- Open/click tracking **off by default** (deliverability + privacy); if enabled, per-campaign setting, and analytics labels it "estimated" (opens are unreliable).

### WP5.5 — Unsubscribe & compliance headers
Every email: visible unsubscribe link + `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers (RFC 8058) + physical-address/sender identity footer (workspace setting; blocks launch if missing). `/api/unsubscribe` writes DNC + stops all campaign_leads for that email in the workspace immediately; idempotent; confirmation page. Reply containing "unsubscribe/stop" is handled in Phase 6 but suppression is enforced here.

### WP5.6 — Failure handling & operator tools
- Provider errors classified: `retryable` (429/5xx/timeouts) vs `permanent` (invalid recipient, blocked sender). Permanent → `failed` with reason; repeated auth/domain errors **auto-pause the campaign** and notify (`activities` + in-app banner + optional email).
- `Send failures` panel (existing `FailedSendsCard` in brief) upgraded: retry-now, skip, view error; dead jobs visible.
- Campaign detail shows real counts from `messages`: queued/sent/delivered/bounced/complained/failed.
- Retire `/api/cron/send-campaigns` (keep as alias calling the tick for one release) and remove LinkedIn from it when D-05 says off.

### WP5.7 — Legacy drain
Legacy `campaign_sends` (pre-rendered) rows processed by an adapter handler until none remain; then delete adapter.

## Out of scope
Inbound/replies (Phase 6), Gmail/Outlook providers (Phase 6/D-04), A/B testing, dedicated IPs, warm-up network, open-rate optimisation, billing.

## Data changes
`0013_jobs_hardened`, `0014_messages_and_events` (`messages`, `message_events`), `0015_campaign_send_idempotency`, workspace `sender_identity` (postal address, sender name), campaign `send_window`/`timezone`.

## Tests (must-have; see `06-quality`)
Double-delivered job → 1 email · kill worker between provider call and DB write → no duplicate, message reconciled · 2 concurrent workers → no double claim · pause mid-run stops within one tick · limits (each) respected · suppression at send time (added after enrollment) blocks · unsubscribe mid-sequence stops later steps · 429 retries with backoff then succeeds · permanent error → failed, no retry · webhook idempotency (same event twice) · signature failure rejected · headers present · lease-expiry recovery · 1,000-recipient campaign drains across ticks within limits.

## Acceptance criteria
- [ ] Sends run only from worker jobs; no long-running request sends mail
- [ ] Idempotent: replaying any send job or webhook never duplicates a send or event
- [ ] Retries with backoff for transient failures; dead-letter state visible in UI
- [ ] Scheduling honors delays, send window, timezone; pause/cancel work promptly
- [ ] Rate limits (campaign, mailbox, workspace, per-domain) enforced and tested
- [ ] Unsubscribe/DNC/bounce/complaint suppress at enrollment **and** send time; one-click unsubscribe headers present
- [ ] Delivered/bounced/complained recorded from provider events; campaign counts derive from `messages`
- [ ] Provider outage or bad domain auto-pauses the campaign and surfaces a clear error
- [ ] Loss test: worker killed mid-batch → all pending sends complete after restart, zero duplicates
- [ ] `npm run verify` green; load test of 1,000 queued sends completes correctly

## Risks
At-most-once vs at-least-once → documented choice + reconciliation. Serverless time limits → time-budgeted ticks, small batches, leases. Deliverability harm from bursts → jitter + ramp. Resend account-level limits/policies → verify current limits, surface provider 429 as `RATE_LIMITED` and back off.

## Exit
Tag `phase-5-complete` (Milestone M2). Mission: [`missions/phase-05-email-engine.md`](../missions/phase-05-email-engine.md).
