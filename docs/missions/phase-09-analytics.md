# Mission: Phase 9 — Analytics

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-09-analytics.md`.

## Objective
A small, honest dashboard: Sent / Delivered / Replies / Interested / Meetings, a funnel, and a campaign comparison — every number defined, reconcilable, and drillable.

## Preconditions
- [ ] Phases 5 and 6 Done (events + classifications exist as source data)

## Read first
`lib/actions/insights.ts`, `components/dashboard/{InsightBoard,StatCard,charts/*}`, `messages`/`message_events`/`inbox_threads` schema, `lib/actions/brief.ts`.

## Work packages
1. **WP9.1 Definitions** — `lib/domain/analytics/definitions.ts` (versioned, documented, unit-tested on fixtures: OOO excluded, overrides win, hard vs soft bounce, sample-size suppression). "Meetings" = manual marker on thread/lead (add the small UI to set it).
2. **WP9.2 Aggregation** — `analytics_daily` + `analytics_aggregation` job (idempotent recompute), timezone-correct days, reconciliation test vs raw.
3. **WP9.3 UI** — performance row, funnel, campaign comparison, deliverability strip, drill-through lists; period + campaign filters; honest empty states.
4. **WP9.4 Cleanup** — retire old Insight Board metrics; anything without a definition is removed.

## Do NOT
Add forecasting, attribution, AI "insights", exports/BI, real-time streaming, or charts beyond the listed ones · show percentages without numerator/denominator · estimate delivered/opens where the provider can't confirm.

## Verification
Definition tests · rollup-vs-raw reconciliation · drill-through counts equal displayed numbers · seed 50k messages and check load time < 1 s · new-workspace empty state · `npm run verify`.

## STOP and ask if
Delivered status isn't reliably available from the provider (decide how to present) · a legacy metric users depend on has no valid definition.

## Report
Format in `docs/missions/README.md`.
