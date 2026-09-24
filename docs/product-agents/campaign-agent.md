# Campaign Agent

**Phase:** 3 (generation) · 4 (campaign tools) · 8 (agent use) · **Tools:** `generate_email`, `create_campaign`, `preview_campaign`, `schedule_campaign`, `pause_campaign`

## Purpose
Turn qualified leads + their evidence into a reviewable email sequence and a `READY` campaign. It prepares; humans approve; the email engine (Phase 5) sends.

## `generate_email`
Input `{ leadId, stepIndex, tone, campaignContext }` → validated draft (schema and validators in `phase-03`): `{ subject, body, angle, used_evidence_ids, personalized_claims[{text, evidence_id}], confidence }`.
- Context built only by `buildContext()`: verified evidence, recent verified signals, the engine's **Outreach Research** output (`why_now`, `why_person`, `potential_problem`, `recommended_angle` from `lead_research`), ICP, workspace positioning, tone rules, prior steps of the sequence (for follow-ups: reference, don't repeat). The Campaign Agent does not research; it writes copy from persisted, verified research.
- Follow-up steps are shorter, add a *new* angle or value, never guilt-trip or fake urgency.
- No evidence → honest generic-relevant note (role/company only), flagged `generic`.

## Sequence proposal
Default 4-step cadence (Day 0 / 3 / 7 / 12), editable. Agent proposes step purposes (intro → value/proof → new angle → break-up) and generates copy per lead in "personalize" mode or per audience in "template" mode.

## `create_campaign`
Creates `draft` with audience snapshot, sequence, mailbox (must be an approved active mailbox), limits (≤ mailbox limit), send window; runs audience resolution and reports exclusions; sets `ready` only when: drafts validated (or template fallback opted-in), sender identity present, unsubscribe footer configured, mailbox healthy. Otherwise returns a checklist of blockers.

## `schedule_campaign`
Creates/reuses an `approvals` row (type `campaign_launch`) — **the agent cannot approve or launch**. Approver launches in UI.

## Hard rules
1. Never sends, never bypasses approval.
2. No unsupported claims (validators; see phase-03).
3. Respect DNC/unsubscribed/cooldown/bounced at enrollment.
4. Limits (`daily_limit`, `total_limit`) are required fields with safe defaults (80/day, audience size).
5. Every generated draft stores prompt/model/input hash for audit (`message_generations`).

## Failure modes
Validator failures → per-lead `failed_validation` with reasons; blocks launch unless fallback chosen. Quota errors → drafts partially complete, resumable. Mailbox unhealthy → campaign stays `draft` with blocker.

## Evals
Personalization fixture set (evidence / thin / none / contradictory); metrics: fabricated-claim rate (target 0), validator catch rate on injected hallucinations (target 100%), tone adherence, length compliance.
