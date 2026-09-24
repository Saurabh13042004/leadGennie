# Phase 10 — Usage & Credits

## Goal
Every expensive operation is metered, priced in credits, estimated before it runs, and limited by a balance — so beta users and costs are controllable. Introduced only now that the core loop works.

## Starting point
`usage_records` are already written (Phase 2 onward) for LLM/provider calls, with tokens/provider/model but not enforced. Agent plans show "estimated credits" as a placeholder (Phase 8). No balance, ledger, or limits exist. `/dashboard/usage` is a stub.

## Scope

### WP10.1 — Credit pricing table (`lib/domain/credits/pricing.ts`)
Configurable, versioned, per operation kind (starting values from PLAN §37, to be recalibrated from real `usage_records` — D-09):

| Operation | Credits |
|---|---|
| Research lead (company + lead research + signals) | 2 |
| Enrich lead | 3 |
| AI personalization (per email draft) | 1 |
| Discovery (per 10 results, once provider exists) | TBD from provider cost |
| Reply classification / reply draft | 0.25 / 1 |
| Email send | 0 (limited by mailbox/plan caps, not credits) |

Cached/deduplicated work (e.g. company already researched < N days ago) costs 0 and is shown as "reused".

### WP10.2 — Ledger & reservations
- `credit_ledger` (append-only) + `credit_balances` view/cached row per workspace. Operations: `grant` (plan/monthly/trial/manual), `reserve` (hold for a run's estimate), `settle` (actual, releasing the difference), `refund` (failed/canceled work), `adjust` (admin, audited).
- **Atomic spend**: reserve/settle in single SQL statements with a `balance >= amount` guard — concurrent jobs can't overspend (tested).
- Every `usage_records` row links to its ledger entry; every ledger entry to a usage record or grant.

### WP10.3 — Enforcement points
- Orchestrator/plan: `estimateCost` → show estimate → **reserve on approval** → block with "Not enough credits (need 350, have 120)" + top-up/upgrade CTA (billing in Phase 11; until then admin grant).
- Direct actions (single-lead *Research*, bulk research, generate drafts, classification) check + spend the same way.
- **Failures refund**; partial completion settles actual usage; canceled runs release the reserve.
- Never silently degrade quality when credits run low — stop and say so.
- Optional workspace hard cap per day/month (owner-configurable) as a safety net against runaway agents.

### WP10.4 — Usage UI (`Settings → Usage & Credits`, replaces stub)
Balance, this-period spend by category (Discovery/Research/Enrichment/AI generation), recent operations (who/what/credits/run link), per-run cost on the run debug page, low-balance banner at 20%, CSV export. Estimates vs actuals shown side by side ("estimated 350, used 312") so users learn the pricing.

### WP10.4b — Engine cost & estimates
The engine's `usage[]` (LLM tokens, search queries, page fetches, provider calls, each with `cost_estimate`) is the metering source for research/discovery credits. `capabilities` advertises per-task unit costs and default budgets so plan estimates are derived from real engine settings; the credit debit uses **actual** `usage[]` at settle time. Budget caps per run (`max_cost_usd`) are set from the credits reserved so a run can never exceed what the user approved.

### WP10.5 — Cost observability (internal)
Internal report: real provider+LLM cost (from tokens/provider fees) vs credits charged per operation → margin sanity check before setting public prices (inputs to Phase 11).

### WP10.6 — Trial & limits
New workspace gets trial credits (configurable, e.g. 100–200) via `grant`; fair-use limits: max leads per import, max research per day, max active campaigns, max sends/day per plan defaults (in `plan_limits` config).

## Out of scope
Payments, invoices, plans/tiers UI, taxes, metered billing to Stripe (Phase 11), team-level cost allocation, coupon codes.

## Data changes
`0020_credit_ledger`, `plan_limits` config (code or table), `workspaces.trial_granted_at`, link columns on `usage_records`.

## Tests
Concurrent reservations never overdraw (property test) · reserve→settle→refund math · idempotent settle (replay) · plan estimate ≈ actual within tolerance on fixtures · cancel releases reserve · insufficient credits blocks *before* the provider call · dedupe reuse costs 0 · ledger append-only (no update/delete permitted by app role) · isolation.

## Acceptance criteria
- [ ] Every expensive operation (research, enrichment, generation, discovery, classification) creates a usage record **and** a ledger entry
- [ ] Plan shows an estimate; run reserves credits; insufficient balance blocks with a clear message
- [ ] Failed/canceled work refunds; ledger balance always equals sum of entries and never goes negative
- [ ] Usage page shows real balance and breakdown by category with per-operation history
- [ ] Concurrent runs cannot overspend (tested)
- [ ] Estimate vs actual reported per run
- [ ] Trial grant applied at signup; per-plan fair-use limits enforced
- [ ] `npm run verify` green

## Risks
Mis-priced credits → derive from real cost data; keep pricing table versioned so history stays accurate. Estimation drift → show variance, recalibrate. Double-charging on retries → ledger entries keyed by `(usage_record_id)` unique.

## Exit
Tag `phase-10-complete`. Mission: [`missions/phase-10-credits.md`](../missions/phase-10-credits.md).
