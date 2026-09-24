# Phase 9 — Analytics

## Goal
A small, honest dashboard of outbound performance — sent, delivered, replied, interested, meetings — plus a funnel and campaign comparison. Do **not** overbuild.

## Starting point
`InsightBoard.tsx`/`lib/actions/insights.ts` show honest real-data metrics (AUD-04), but are built on `campaign_sends`. `messages`/`message_events`, `inbox_threads.classification`, and `agent_runs` now exist (Phases 5, 6, 8). Phase 5/6 were required to **write events as they go** so this phase is aggregation + UI only.

## Scope

### WP9.1 — Metric definitions (single source of truth)
`lib/domain/analytics/definitions.ts`, versioned, documented on the page ("How is this calculated?"):

| Metric | Definition |
|---|---|
| Sent | outbound `messages` with `status ≥ sent` in period (by `sent_at`) |
| Delivered | `delivered_at` present (provider-confirmed) — where provider can't confirm, show "—" not an estimate |
| Bounced | hard + soft bounces (split) |
| Replied | distinct threads with a human inbound reply (excludes OOO/bounce/auto-reply) |
| Interested | threads classified `INTERESTED` or `MEETING_REQUEST` (user overrides win) |
| Meetings | **manual** marker: user marks a thread/lead "Meeting booked" (calendar integration is out of scope) |
| Reply rate | replied / delivered (denominator explicit; hidden if delivered < 20) |
| Interested rate | interested / delivered |

All rates show numerator/denominator on hover; **small samples show counts only** with "not enough data". Opens/clicks (if tracking enabled) are labelled *estimated*. Time zone = workspace timezone, consistent day boundaries.

### WP9.2 — Aggregation
`analytics_aggregation` job (hourly + on-demand) writes daily rollups `analytics_daily(workspace_id, campaign_id null, day, sent, delivered, bounced, complained, replied, interested, meetings, …)`. Rollups are idempotent (recompute a day from source rows). Live "today" computed directly. Raw tables remain the source of truth; a reconciliation test compares rollups to raw counts.

### WP9.3 — UI (`/dashboard/analytics`)
1. **Outbound performance** row: Sent · Delivered · Replies · Interested · Meetings (period selector 7/30/90 days, campaign filter).
2. **Funnel**: Leads → Contacted → Delivered → Replied → Interested → Meeting (counts + step conversion).
3. **Campaign comparison** table: Campaign · Leads · Sent · Reply % · Interested % (sortable; hides % below sample threshold).
4. **Drill-through** (DAS-02): clicking any number opens the underlying leads/threads/messages list.
5. Quiet **deliverability health** strip: bounce rate, complaint rate, with thresholds and a warning when high (ties to Phase 5 auto-pause).
No other charts. No "AI insights", no forecasts.

### WP9.4 — Cleanup
Retire/redirect the old Insight Board content; the Command Center shows live operational counts only. Delete any metric that can't be tied to a definition.

## Out of scope
Attribution, revenue/pipeline forecasting, cohort analysis, A/B analytics, exports/BI, real-time streaming.

## Data changes
`0019_analytics_daily`; ensure `message_events` has the indexes needed for rollups.

## Tests
Metric definitions unit tests on fixtures (each edge: OOO excluded, override wins, hard vs soft bounce) · rollup == raw recount · idempotent recompute · timezone day boundary · small-sample suppression · drill-through counts match displayed number · isolation.

## Acceptance criteria
- [ ] Sent, delivered, bounced, replied, interested, meetings shown from real data with documented definitions
- [ ] Funnel and campaign comparison render correctly; every % has its numerator/denominator
- [ ] Any number is drillable to the underlying records and the counts match
- [ ] Empty/new workspaces show honest empty states — no placeholder numbers
- [ ] Rollup reconciliation test passes against raw counts
- [ ] Page loads < 1 s for a workspace with 50k messages
- [ ] `npm run verify` green

## Risks
Delivered/opened accuracy depends on provider → label limitations plainly. Reply classification errors skew "Interested" → user override wins, and definitions say so.

## Exit
Tag `phase-9-complete`. Mission: [`missions/phase-09-analytics.md`](../missions/phase-09-analytics.md).
