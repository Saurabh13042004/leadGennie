# Mission: Phase 6 — Inbox & Reply Intelligence

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-06-inbox.md`. Agent spec: `product-agents/inbox-agent.md`.

## Objective
Replies arrive, attach to the right lead/campaign/thread, get classified, stop the sequence, and produce an editable suggested response that is sent **only** when the user clicks Send. This closes the V1 loop.

## Preconditions
- [ ] Phase 5 Done
- [ ] **D-04 resolved.** If Gmail OAuth: Google Cloud project, OAuth consent screen, credentials, and a test Gmail account exist (production scope verification may lag — develop in testing mode). If Resend inbound: DNS/MX on a reply subdomain available.
- [ ] `lib/crypto.ts` key configured (mailbox tokens are encrypted)

## Read first
`components/inbox/*` (current form-submission "inbox" to preserve as a tab), `lib/actions/forms.ts`, mailboxes actions/schema, Phase 5 `messages`/`MailProvider`, `lib/crypto.ts`, tasks actions (follow-up tasks), verify Gmail API / Resend inbound docs before implementing.

## Work packages
1. **WP6.1 Provider #2 + connect flow** — OAuth (or inbound webhook), encrypted tokens, `email_sync` job with cursor, `needs_reauth` handling, Settings → Connect email. Outbound via the same provider keeps threads. *Exit:* send from and receive into a test mailbox.
2. **WP6.2 Threading/matching** — order: `In-Reply-To`/`References` → provider thread id → sender+subject fallback → **Unmatched tray**. Idempotent ingest.
3. **WP6.3 Deterministic side-effects** — reply ⇒ stop sequence/cancel pending; OOO ⇒ pause; DSN ⇒ bounce handling; UNSUBSCRIBE ⇒ DNC. Works even if the LLM is down. *Exit:* tests.
4. **WP6.4 Classification** — rules pre-pass + LLM structured classifier, override UI, corrections logged, task creation for INTERESTED/MEETING_REQUEST.
5. **WP6.5 Draft reply** — `workspaces.reply_context` (facts source), validators (no invented facts, `[YOU NEED TO ADD…]` placeholders), never auto-sent.
6. **WP6.6 Inbox UI** — filters/counts, thread list, conversation, lead card, suggestion block (Edit/Regenerate/Send), classification override; Forms kept as a tab. `sendReply` = user-initiated server action only.
7. **WP6.7 Compliance** — hard-block replies to DNC/unsubscribed; footer policy.
8. **V1 gate** — run the full E2E (`docs/06-quality-and-testing.md`) with a real mailbox; capture evidence.

## Do NOT
Auto-send anything · build meeting booking/calendar · shared inbox assignment/SLA · LinkedIn/WhatsApp inbox · expose a send tool to any LLM path · store OAuth tokens unencrypted.

## Verification
Threading, idempotent ingest, OOO/DSN/auto-reply, UNSUBSCRIBE-always-suppresses (even low confidence), classification schema/retry, sequence-stop, hallucination fixtures for drafts, DNC send block, **a test that proves no code path sends an AI draft without a user-initiated action**, token-expiry pause, isolation · live: reply from a real inbox and watch it appear ≤ 2 min · `npm run verify`.

## STOP and ask if
Google restricted-scope verification blocks non-test users (need decision on fallback B) · reply matching accuracy is poor on real data (share samples) · classification of unsubscribe intent has any false negative in your fixtures.

## Report
Format in `docs/missions/README.md`, including the V1 gate results.
