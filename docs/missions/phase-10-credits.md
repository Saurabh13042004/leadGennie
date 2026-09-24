# Mission: Phase 10 — Usage & Credits

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-10-credits.md`.

## Objective
Every expensive operation is metered, estimated before it runs, charged from a credit balance with no possibility of overspend, refunded on failure, and visible to the user.

## Preconditions
- [ ] Phase 8 Done (plans/estimates exist)
- [ ] **D-09** initial credit prices agreed (PLAN §37 values are the default)
- [ ] `usage_records` have been accumulating real data since Phase 2 (use it to sanity-check prices)

## Read first
`usage_records` writers in `lib/ai/client.ts` and provider adapters, `lib/agent/orchestrator.ts` (estimate/reserve hook points), `app/dashboard/usage/page.tsx` (stub), job handlers that call LLMs/providers.

## Work packages
0. **Engine metering hookup** — read engine `usage[]` + `capabilities` unit costs; derive estimates from them; pass `max_cost_usd` budgets from reserved credits so a run cannot exceed what the user approved (spec: WP10.4b).
1. **WP10.1 Pricing table** — versioned config; cache/reuse → 0 credits and shown as "reused".
2. **WP10.2 Ledger** — append-only `credit_ledger`, atomic reserve/settle/refund/grant/adjust in single guarded SQL; link to `usage_records`. *Exit:* property test — concurrent spends never overdraw.
3. **WP10.3 Enforcement** — plan estimate → reserve on approval → block with clear message; same gate for direct actions (research, bulk generation, classification); refund on failure/cancel; optional workspace daily/monthly hard cap.
4. **WP10.4 Usage UI** — replace stub: balance, breakdown by category, recent operations with run links, low-balance banner, estimate-vs-actual per run, CSV export.
5. **WP10.5 Cost report** — internal script: real cost vs credits per operation (input to pricing/billing).
6. **WP10.6 Trial & limits** — trial grant at signup; `plan_limits` fair-use enforced.

## Do NOT
Integrate payments · build plan/tier UI · charge for email sends (limits only) · let any code path spend without a ledger entry · silently downgrade quality when low on credits.

## Verification
Concurrency/property tests, idempotent settle, cancel releases, insufficient credits blocks before provider call, dedupe reuse costs 0, ledger immutability, isolation · manual: run a plan with a low balance, then a sufficient one, compare estimate vs actual · `npm run verify`.

## STOP and ask if
Real cost per operation exceeds the PLAN credit values by a wide margin (pricing decision needed) · reservation semantics conflict with long-running/paused runs.

## Report
Format in `docs/missions/README.md`, including the cost-vs-credit table.
