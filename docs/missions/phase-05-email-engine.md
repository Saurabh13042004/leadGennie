# Mission: Phase 5 — Email Execution Engine

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-05-email-engine.md`. Architecture: `docs/02-architecture.md` (jobs, email pipeline).

## Objective
Sending becomes durable and safe: worker-driven, idempotent, rate-limited, suppression-aware, event-tracked. Killing a worker mid-batch loses nothing and duplicates nothing.

## Preconditions
- [ ] Phase 4 Done
- [ ] **D-01 resolved** (Postgres queue recommended) and **D-04** direction known (provider abstraction must fit Gmail later)
- [ ] `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET` valid in the test environment; a verified test domain/mailbox available
- [ ] Sender identity (postal address) policy decided for footer

## Read first
`lib/campaigns/dispatch.ts`, `app/api/cron/send-campaigns/route.ts`, `scripts/scheduler.mjs`, `lib/email/resend.ts`, `app/api/webhooks/resend/route.ts`, `lib/unsubscribe.ts`, `app/api/unsubscribe/route.ts`, `lib/compliance.ts`, Phase 2's minimal jobs code, Resend docs for idempotency keys and webhook event types (verify current behavior).

## Work packages
1. **WP5.1 Job runtime** — harden `jobs` (claim/lease/backoff/dead/cancel), registry with zod payloads, `/api/jobs/tick`, `scripts/worker.mjs`; port Phase 2 jobs. *Exit:* concurrency test — 2 workers, no double-claim; lease expiry recovery.
2. **WP5.4 Provider abstraction** — `MailProvider` + `ResendProvider` + `FakeMailProvider`; webhook handler extended (delivered/bounced/complained/opened/clicked; idempotent by event id; `message_events`).
3. **WP5.3 SendGate** — all limits + jitter + ramp + send window in one tested module.
4. **WP5.2 Scheduler + `campaign_send`** — idempotency keys, precheck, message-before-send, reconciliation on retry (**at-most-once**), next-step scheduling, stop conditions. *Exit:* kill-worker test → zero duplicates, all sends complete after restart.
5. **WP5.5 Compliance headers/footer** — RFC 8058 headers, identity footer (launch blocked without it), unsubscribe stops all `campaign_leads` for the email.
6. **WP5.6 Failure handling/UI** — error classification, auto-pause on systemic errors, failures panel with retry/skip, real counts from `messages`.
7. **WP5.7 Legacy drain** — adapter for legacy `campaign_sends`; retire `/api/cron/send-campaigns` (alias to tick for one release); LinkedIn removed from this path per D-05.

## Do NOT
Ingest replies (Phase 6) · build Gmail/Outlook providers · add A/B tests · send in a request handler · enable open/click tracking by default · "fix" duplicate risk with at-least-once retries.

## Verification
The must-have test list in the spec (double delivery, kill-worker, concurrent workers, pause, each limit, suppression-at-send, unsubscribe mid-sequence, 429 backoff, permanent error, webhook idempotency/signature, headers, lease recovery, 1,000-recipient drain) · staging run sending to **your own test inboxes only** · confirm headers in a received message · `npm run verify`.

## STOP and ask if
Provider offers no idempotency/lookup to reconcile a crash window (document the residual risk and get a decision) · production has legacy campaigns mid-flight that the drain adapter can't safely handle · any test would email real leads.

## Report
Format in `docs/missions/README.md`, including the crash/duplicate test transcript.
