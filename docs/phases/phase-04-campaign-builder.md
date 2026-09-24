# Phase 4 — Campaign Builder

## Goal
`Campaign → Audience → Sequence → Personalization → Preview → Approval → Launch` — a builder where every step is editable, every message is previewable per lead, and nothing sends without approval.

## Starting point
`CampaignWizard.tsx` (623 lines; split in Phase 0) creates campaigns with an audience (segment or all leads), 3 default steps (email / LinkedIn DM / email), mailbox selection, optional workflow template, and `createCampaign()` **pre-materializes a `campaign_sends` row for every lead × step** with a rendered body and `scheduled_at`, gated by an `approvals` row (`campaigns.approval_id`). DNC/cooldown filtering happens at creation and again at dispatch.

## Scope

### WP4.1 — Lifecycle & model
- Status machine: `draft → ready → running ⇄ paused → completed | failed` (+ `canceled`). Add `campaigns.total_limit`, `daily_limit`, `audience_definition jsonb`, `approved_at/started_at/completed_at`, `created_by_user_id`.
- **`campaign_leads`** (per-lead state, see `03-data-model.md`) replaces pre-materialized future sends as the scheduling source: creation enrolls leads as `pending`; launch flips them `active` with `next_action_at`; sends are produced *just-in-time* by Phase 5's `campaign_send` job (so edits to later steps, pausing, replies and unsubscribes take effect without rewriting thousands of rows).
- Migration keeps existing in-flight campaigns working: legacy `campaign_sends` rows remain valid until drained; new campaigns use the new model. (Compat shim documented; removed after drain.)
- **V1 = email only**: `linkedin_dm` hidden unless `FEATURE_LINKEDIN_AUTOMATION` (D-05); `campaign_steps.channel` constrained to allowed values per flag.

### WP4.2 — Builder steps (page `/dashboard/campaigns/new` → `/dashboard/campaigns/[id]/edit`)
1. **Basics** — name, mailbox (from approved `mailboxes` only), tone, limits (`daily_limit`, `total_limit`), send window (days/hours + timezone), stop conditions (reply / unsubscribe / bounce — always on, shown).
2. **Audience** — pick a saved segment, filter by ICP score ≥ N / research status / signals, or select leads; live count with **breakdown of exclusions** (DNC, unsubscribed, bounced, cooldown, no email, invalid email, already in another active campaign, unresearched). Snapshot stored in `audience_definition`; enrollment resolves at *launch approval* (shown as "will enroll N").
3. **Sequence** — steps (Day 0 / 3 / 7 / 12 default), per-step delay, subject/body templates with placeholders + "personalize per lead" mode (uses Phase 3 drafts) vs "template" mode. Add/remove/reorder; all steps editable. Follow-ups are threaded replies (same subject "Re:").
4. **Personalization** — generate drafts for the audience (job with progress); review queue; per-lead edit; unresolved/failed drafts block launch with a clear list (or "send template fallback" explicit opt-in).
5. **Preview** — pick any lead → see exact rendered emails for all steps, with unsubscribe footer, sender, send schedule; spam-lint warnings; test-send to yourself.
6. **Review & approve** — summary (audience size, exclusions, schedule, limits, from-address, deliverability warnings such as unverified domain / low daily limit), then **Submit for approval**. Owner/admin approves via existing approvals engine (owners can self-approve if sole member). Approved → `ready`; **Launch/Schedule** sets `running` with start time.

### WP4.3 — Campaign list & detail
List: status, audience size, sent/replied (real counts; blanks when zero, no fabricated rates), next send. Detail: per-lead status table (pending/sent/replied/stopped + reason), pause/resume/cancel, edit-while-running (future steps only; changes to sent steps are locked), activity log.

### WP4.4 — Compliance at build time
Enrollment applies the same rules as send time (`lib/compliance.ts`): DNC, unsubscribed, bounced/complained, cooldown, invalid email, role/disposable risk. Counts are **shown, not silently dropped**. Cross-campaign duplicate protection: a lead can be active in only one campaign at a time (configurable).

### WP4.5 — Cleanup
Remove the fake predicted-rate leftovers if any remain; delete wizard-only decorative state; ensure `workflow` templates (Agentic Flows) can still seed a sequence.

## Out of scope
The sending engine, retries, events (Phase 5); A/B testing; multi-channel; new-lead discovery from the builder; billing limits.

## Data changes
`0012_campaign_lifecycle_and_leads`, `campaign_steps` extensions, migration/compat for legacy sends.

## Interfaces
`POST /api/campaigns` · `PATCH /api/campaigns/:id` · `GET /api/campaigns/:id/preview?leadId=` · `POST /api/campaigns/:id/launch` · `POST /api/campaigns/:id/pause|resume|cancel` · `POST /api/campaigns/:id/audience/resolve` (returns counts + exclusions) — all envelope + zod. Agent-tool-shaped: `createCampaign`, `previewCampaign`, `scheduleCampaign` (needs approval), `pauseCampaign`.

## Tests
Audience resolution + exclusion counts (each reason) · state-machine transitions (illegal ones rejected) · launch requires approved approval · editing sent step blocked · enrollment idempotent · legacy campaign still dispatches · limits validated (`daily_limit ≤ mailbox.daily_limit`) · isolation.

## Acceptance criteria
- [ ] User can build a multi-step (≥4) email campaign end-to-end; every step editable
- [ ] Preview shows exactly what a chosen lead will receive, for every step
- [ ] Exclusions (DNC/unsub/bounce/cooldown/invalid) are counted and shown before approval
- [ ] Launch is impossible without an approved approval; approval is recorded with actor + time
- [ ] Draft/failed-validation personalization blocks launch (or explicit fallback opt-in)
- [ ] `daily_limit`/`total_limit` stored and validated against mailbox limits
- [ ] Pause/resume/cancel work and are reflected in `campaign_leads`
- [ ] No invented metrics anywhere in the builder or list
- [ ] Existing running campaigns keep working through the migration
- [ ] `npm run verify` green; wizard split into components < 300 lines each

## Risks
Two send models coexisting (legacy pre-rendered vs JIT) → strict compat shim + drain plan; feature-flag the new builder until Phase 5 lands if needed.
Long audience resolution for big segments → run as job + poll.

## Exit
Tag `phase-4-complete`. Mission: [`missions/phase-04-campaign-builder.md`](../missions/phase-04-campaign-builder.md). Agent spec: [`campaign-agent`](../product-agents/campaign-agent.md).
