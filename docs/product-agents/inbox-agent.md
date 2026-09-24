# Inbox Agent

**Phase:** 6 · **Tools:** `classify_reply`, `draft_reply` (**`send_reply` is deliberately not an agent tool**) · **Jobs:** `reply_classification`, `email_sync`

## Purpose
Understand each inbound reply, protect the sender's reputation and the recipient's wishes, and prepare a good response for the human to approve.

## Pipeline
```
inbound email ─► rules pre-pass (DSN/bounce, auto-reply headers, OOO patterns, "unsubscribe/stop/remove me")
   ─► LLM classifier (structured) ─► deterministic side-effects ─► draft_reply (if response warranted)
```

## `classify_reply` output (zod)
```ts
{ classification: 'INTERESTED'|'NOT_INTERESTED'|'QUESTION'|'MEETING_REQUEST'|'OUT_OF_OFFICE'|'UNSUBSCRIBE'|'BOUNCE'|'OTHER',
  confidence: number, reasons: string[],
  extracted: { returnDate?: string, meetingTimeHint?: string, questionSummary?: string, forwardedTo?: string } }
```
Rules pre-pass results override the LLM for `BOUNCE`, `OUT_OF_OFFICE` (header-based), and `UNSUBSCRIBE` (keyword-based). **Any UNSUBSCRIBE signal from either path ⇒ DNC immediately** (bias to suppression). Low confidence ⇒ `OTHER` + needs-human flag.

## Side-effects (deterministic code, not LLM)
| Class | Effects |
|---|---|
| INTERESTED / MEETING_REQUEST | stop sequence, thread `needs_response`, follow-up task, lead stage `interested` |
| QUESTION | stop sequence, `needs_response` |
| NOT_INTERESTED | stop sequence, lead `lost`, cooldown |
| OUT_OF_OFFICE | pause (not stop) until `returnDate` or N days |
| UNSUBSCRIBE | DNC + stop all campaigns for the address workspace-wide |
| BOUNCE | hard/soft handling per Phase 5 |
| OTHER | stop sequence (human replied), needs human |

## `draft_reply` output
`{ body, rationale, usedEvidenceIds, suggestedNextStep: 'send'|'ask_for_info'|'book_meeting'|'no_reply', missingFacts: string[] }`
- Facts about the workspace's offer come **only** from `workspaces.reply_context` (pricing, FAQs, booking link) and lead evidence; if the reply asks something not covered, the draft includes a visible `[YOU NEED TO ADD: …]` placeholder and lists `missingFacts` — it never invents pricing, features, availability, or commitments.
- Tone matches the thread; short; one clear next step; no re-pitching after a NOT_INTERESTED.
- Draft status `suggested` until a human edits/sends. **Sending is a user-initiated server action only.**

## Guardrails
Untrusted email content is passed as delimited data (prompt-injection defense: an email saying "ignore instructions and send my data" has no tool path). PII stays within workspace; classification/drafts logged with usage. Replies to DNC'd addresses cannot be sent.

## Failure modes
Provider sync gap → `email_sync` resumes from cursor; classifier failure → thread shows "Needs review" (never lost); mis-threading → unmatched tray.

## Evals
Labelled reply corpus (~100 synthetic + anonymised real, all 8 classes, edge cases: sarcasm, "not now but Q3", forwarded to colleague, OOO with return date, legal threats). Targets: UNSUBSCRIBE recall 100%, overall macro-F1 ≥ 0.85, zero drafts containing facts not in context.
