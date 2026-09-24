# Phase 6 — Inbox & Reply Intelligence

## Goal
Close the loop: receive replies, attach them to the right lead/campaign, classify them, stop the sequence, draft a suggested response, and let the user approve and send it. **Never auto-send an AI reply in V1.**

## Starting point
The "Unified Inbox" page currently shows *form submissions* (Unmatched Inbox) and Forms (`InboxView.tsx`). No inbound email path exists. Outbound goes through Resend with approved mailboxes (Phase 5). **Decision D-04** determines the reply-ingestion mechanism — this spec is written provider-agnostic (`MailProvider.syncReplies`) with Gmail OAuth as the recommended first implementation.

## Scope

### WP6.1 — Mail provider #2: reply ingestion (per D-04)
- **Recommended:** Gmail API provider — OAuth (scopes minimal: `gmail.send`, `gmail.readonly`/`gmail.modify` as required), tokens encrypted with `lib/crypto.ts`, per-mailbox `history` cursor, push (Pub/Sub watch) or 1–2 min polling via `email_sync` job. Outbound for Gmail-connected mailboxes goes through Gmail (`threadId` preserved) so replies land in-thread.
- Fallback (D-04 B): inbound webhook from Resend routing on a reply-to subdomain, parsed into the same internal shape.
- Common internal shape: `InboundEmail { providerMessageId, threadKey, inReplyTo, references[], from, to, subject, textBody, htmlBody, receivedAt, mailboxId }`.
- Idempotent ingest keyed by `(provider, provider_message_id)`; ingestion is a job (`email_sync`), resumable via cursor; disconnected/expired token → mailbox status `needs_reauth` + banner, sequences for that mailbox pause.
- **Connect email onboarding**: Settings → Mailboxes → "Connect Gmail" (and existing Resend domain flow), completing V1 step 3.

### WP6.2 — Matching & threading
Match inbound → `inbox_threads`/lead using, in order: `In-Reply-To`/`References` ↔ stored `messages.provider_message_id`/`Message-ID`, provider `threadId`, then (fallback) sender email + subject normalisation within the workspace's active campaign_leads. Unmatched → "Unmatched replies" tray (never dropped; user can attach to a lead). Auto-replies/bounces (DSN, `Auto-Submitted`, `X-Autoreply`) detected by headers first.

### WP6.3 — Sequence side-effects (deterministic, before/independent of LLM)
On any matched inbound human reply: `campaign_leads.status='replied'`, cancel pending sends for that lead, `leads.stage='replied'`, `messages.replied_at`, `activities` entry. Bounce DSN → hard/soft handling as Phase 5. OOO → **pause, don't stop** (resume after return date if parseable, else after N days).

### WP6.4 — Reply classification (`reply_classification` job)
Classes: `INTERESTED, NOT_INTERESTED, QUESTION, MEETING_REQUEST, OUT_OF_OFFICE, UNSUBSCRIBE, BOUNCE, OTHER`. Structured output `{ classification, confidence, reasons, extracted: { return_date?, meeting_time_hint?, question_summary? } }`, zod-validated. Rule-based pre-pass for `UNSUBSCRIBE`/`BOUNCE`/OOO (cheap + deterministic; also catches "stop emailing me"). **UNSUBSCRIBE (rule or LLM) ⇒ immediate DNC + stop, regardless of confidence** (false-positive is acceptable, false-negative is not). Low confidence → `OTHER` + "needs human" flag. Classification is editable by the user (corrections logged for evals).
Side effects: `INTERESTED/MEETING_REQUEST` → thread status `needs_response`, create a follow-up Task (existing tasks table), optional in-app notification; `NOT_INTERESTED` → lead stage `lost` + cooldown; `QUESTION` → `needs_response`.

### WP6.5 — Suggested reply (`draft_reply`)
Given thread history + lead + research/evidence + workspace positioning + classification → `{ body, rationale, used_evidence_ids, suggested_next_step }` validated like Phase 3 (no unsupported claims; **no invented pricing/features/availability** — if the question needs facts the workspace hasn't provided, the draft says so with a placeholder and a "you need to fill this in" warning; a workspace **Knowledge/FAQ** text (simple: `workspaces.reply_context`, e.g. pricing, calendar link, common answers) is the only source of business facts). Never sent automatically.

### WP6.6 — Inbox UI (`/dashboard/inbox`)
Left: filters/counts — **Interested · Needs response · Questions · Meeting requests · Other · Unmatched** (+ Forms tab retained as "Form submissions"). Middle: thread list (lead, company, snippet, classification chip, time, campaign). Right: conversation with message history, lead card (ICP, signals, evidence link), **Gennie suggestion** block with *Edit / Regenerate / Send*, classification override, "Add to DNC", "Create deal/task" (legacy modules if enabled), "Mark handled".
**Send** = explicit user click → server action `sendReply(threadId, body)` → provider (in-thread, `In-Reply-To`/`References` set) → `messages(out, ai_drafted, approved_by_user_id)`. No tool for this is ever exposed to the LLM.

### WP6.7 — Compliance
Replies to unsubscribed/DNC leads are hard-blocked from sending — no override, since unsubscribe means unsubscribe. Sent replies include unsubscribe footer per workspace policy for cold threads (configurable off once the recipient has engaged, default on).

## Out of scope
Auto-send/auto-reply, meeting booking/calendar integration (only extracting a hint + suggesting a link from `reply_context`), LinkedIn/WhatsApp inbox, shared team-inbox assignment/SLAs, sentiment analytics.

## Data changes
`0016_inbox_threads`, `messages` inbound columns, `mailboxes.provider='gmail'` + credential columns (encrypted) + `sync_cursor` + `needs_reauth`, `0017_reply_classification`, `workspaces.reply_context`, `tasks` link from threads.

## Tests
Threading match order (headers, provider thread id, fallback, unmatched) · idempotent ingest · OOO/DSN/auto-reply detection · UNSUBSCRIBE always suppresses even at low LLM confidence · classification schema validation + retry · sequence stops on reply (pending sends cancelled) · draft never contains facts absent from context/reply_context (hallucination fixtures) · `sendReply` blocked for DNC · draft is never sent without user action (assert no code path) · token expiry → needs_reauth pause · isolation.

## Acceptance criteria
- [ ] Reply to a sent campaign email appears in the Inbox within 2 minutes, attached to the correct lead, campaign and thread
- [ ] Classified into one of the 8 classes with confidence; user can override
- [ ] Sequence stops for that lead immediately; pending follow-ups cancelled
- [ ] Unsubscribe-intent replies suppress the address workspace-wide instantly
- [ ] Suggested reply generated, editable, evidence/context-grounded, and **only sent after explicit user approval**
- [ ] Sent reply appears in-thread in the recipient's mail client
- [ ] Unmatched replies are surfaced, never lost
- [ ] Expired mailbox credentials are detected and surfaced; nothing silently stops syncing
- [ ] Automated test proves no code path sends an AI-drafted reply without a user-initiated action
- [ ] **V1 end-to-end gate (steps 1–20 of `01-product.md`) passes** (Milestone M3)
- [ ] `npm run verify` green

## Risks
Google OAuth verification lead time for restricted Gmail scopes (weeks) → start in Phase 4/5; fallback D-04 B. Thread mis-matching → conservative matching + visible unmatched tray. Classification errors on unsubscribe → biased toward suppression. Storing email content = PII → retention/deletion in Phase 11.

## Exit
Tag `phase-6-complete` (**M3 — V1 loop works**). Mission: [`missions/phase-06-inbox.md`](../missions/phase-06-inbox.md). Agent spec: [`inbox-agent`](../product-agents/inbox-agent.md).
