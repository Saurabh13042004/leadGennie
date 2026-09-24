# Mission: Phase 4 — Campaign Builder

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-04-campaign-builder.md`.

## Objective
A builder for Audience → Sequence → Personalization → Preview → Approval → Launch, where every step is editable, every message is previewable per lead, and launch is impossible without approval.

## Preconditions
- [ ] Phase 3 Done
- [ ] **D-05** answered (LinkedIn channel default off) and **D-06** (legacy modules hidden)
- [ ] Understand the legacy model: `createCampaign` currently pre-materializes `campaign_sends`

## Read first
`lib/actions/campaigns.ts`, `components/campaigns/wizard/*` (post-Phase-0 split), `lib/campaigns/{dispatch,personalize,scheduling}.ts`, `lib/actions/approvals.ts`, `lib/compliance.ts`, `lib/actions/workflows.ts` (workflow → campaign snapshot), mailboxes/domains actions.

## Work packages
1. **WP4.1 Model** — lifecycle statuses + columns, `campaign_leads`, migration + **compat shim** so legacy pre-rendered campaigns keep dispatching; feature-flag channels (`linkedin_dm` hidden unless flagged). *Exit:* an existing running campaign still sends in a test.
2. **WP4.4 Audience/compliance service** — `resolveAudience()` returning enrollable set + exclusion counts per reason; used by builder and (later) agent. Table tests for each reason.
3. **WP4.2 Builder UI** — steps: Basics → Audience → Sequence → Personalization → Preview → Review/Approve; all steps editable; preview any lead, test-send to self; blockers list. Reuse Phase 3 preview panel. *Exit:* build a 4-step campaign in the running app.
4. **WP4.1b Lifecycle actions** — state machine + `launch/pause/resume/cancel` with approval enforcement; envelope APIs.
5. **WP4.3 List & detail** — real counts only; per-lead status table; edit-future-steps-only.
6. **WP4.5 Cleanup** — remove leftovers; workflow templates still seed sequences.

## Do NOT
Implement the sending worker/retries/events (Phase 5) — launch just marks `campaign_leads` active with `next_action_at` and the legacy dispatcher/compat path must still be what actually sends for now, or sending is disabled behind a flag until Phase 5 · A/B tests · multi-channel · billing.

## Verification
State-machine, audience, approval-enforcement, immutable-sent-step tests · isolation · manual: full build → approve → launch flow with a real approved mailbox in a test workspace (no real leads) · confirm preview equals what the compat sender would send · `npm run verify`.

## STOP and ask if
The compat shim can't preserve existing campaigns without a risky data migration · owners/approvers semantics (self-approval for solo workspaces) are unclear.

## Report
Format in `docs/missions/README.md`.
