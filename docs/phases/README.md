# Phases — Roadmap

Strict order. **Do not start phase N+1 until phase N's acceptance criteria pass** (rule 25). Each phase spec follows the same template: Goal · Starting point · Scope · Out of scope · Work packages · Data changes · Interfaces · UX · Tests · Acceptance criteria · Risks · Exit.

```
P0 Stabilize ─► P1 Lead foundation ─► P2 Lead intelligence (2A Python engine ∥ 2B app) ─► P3 Personalization
      ─► P4 Campaign builder ─► P5 Email engine ─► P6 Inbox ─► P7 Extension
      ─► P8 Gennie agent ─► P9 Analytics ─► P10 Credits ─► P11 Billing ─► BETA
```

| Phase | Spec | One-line goal | Depends on | Blocking decisions | Rough size |
|---|---|---|---|---|---|
| 0 | [phase-00-stabilization](phase-00-stabilization.md) | Make the codebase safe to extend; kill fake metrics; tests + migrations + nav | — | D-08, D-10 | 1–1.5 wk |
| 1 | [phase-01-lead-foundation](phase-01-lead-foundation.md) | Reliable lead + company system, robust CSV import | 0 | D-07 | 1 wk |
| 2A | [phase-02 → 2A](phase-02-lead-intelligence.md) | **Python Intelligence Engine**: connectors, extraction, 5 agents incl. Evidence Validator, scoring, contract + fake mode | 0 | **D-02, D-03 (search/news provider), D-11 ✔, D-12** | 2 wk |
| 2B | [phase-02 → 2B](phase-02-lead-intelligence.md) | App side: engine client, persistence, jobs, ICP editor, lead detail page (research, score, signals, verified evidence) | 1, 2A contract (WP2A.1) | D-02 | 1.5 wk |
| 3 | [phase-03-ai-personalization](phase-03-ai-personalization.md) | Evidence-backed per-lead emails, editable | 2 | D-02 | 1–1.5 wk |
| 4 | [phase-04-campaign-builder](phase-04-campaign-builder.md) | Audience → sequence → preview → approval → launch UI/model | 3 | D-05, D-06 | 1.5 wk |
| 5 | [phase-05-email-engine](phase-05-email-engine.md) | Durable, idempotent, rate-limited sending + events | 4 | **D-01**, D-04 | 2 wk |
| 6 | [phase-06-inbox](phase-06-inbox.md) | Reply ingestion, classification, suggested replies, approve-and-send | 5 | **D-04** | 2 wk |
| 7 | [phase-07-chrome-extension](phase-07-chrome-extension.md) | Extension as capture + "Research with Gennie" | 2 | D-05 | 0.5–1 wk |
| 8 | [phase-08-gennie-agent](phase-08-gennie-agent.md) | Command Center + orchestrator + tools + runs debug page | 2–6 | D-03 | 2 wk |
| 9 | [phase-09-analytics](phase-09-analytics.md) | Funnel + campaign comparison from real events | 5, 6 | — | 0.5–1 wk |
| 10 | [phase-10-credits](phase-10-credits.md) | Usage metering, credit ledger, estimates, limits | 8 | D-09 | 1 wk |
| 11 | [phase-11-billing-beta](phase-11-billing-beta.md) | Landing rebuild, onboarding, billing, compliance, beta launch | all | — | 1.5 wk |

Sizes are engineer-weeks with an AI coding agent doing the bulk and a human reviewing; they are estimates for planning, not commitments.

## Parallelism that is safe

- **2A (Python engine) can start right after Phase 0** — it depends on nothing in Phase 1's schema. **2B starts against the engine's fake mode** as soon as WP2A.1 (contract + fake) is merged; the two then proceed in parallel and converge at the real-engine acceptance.
- Phase 7 (extension capture) can run alongside Phase 5/6 once Phase 2 exists.
- Phase 9's event capture is added *during* Phases 5–6 (write events as you go); Phase 9 itself is only the UI/aggregation.
- Landing page copy work (Phase 11 subset) can start any time, but fake-content **removal** is Phase 0.

## Cross-cutting requirements (apply to every phase)

- Follow `04-engineering-rules.md` and the Definition of Done.
- Each phase ends with: migrations applied clean, `npm run verify` green (`verify:all` from 2A on: Next + engine + contract), workspace-isolation test extended for new tables, the phase's golden-path exercised in a running app, `docs/README.md` status table updated with evidence.
- Each phase adds/updates its section of **`docs/CHANGELOG-phases.md`** (created in Phase 0) listing what shipped, deviations, and follow-ups.

## Milestone view

| Milestone | After phase | What you can demo |
|---|---|---|
| **M0 Foundation** | 0 | Clean, honest app: 6-item nav, no fake numbers, tests + migrations |
| **M1 Smart leads** | 2A + 2B | Import → research (Python engine) → ICP score → signals → **verified** evidence on a lead detail page |
| **M2 Outbound** | 5 | Evidence-backed emails → approved campaign → reliable sending |
| **M3 Closed loop** | 6 | Replies classified, suggested response approved and sent — **the V1 loop works** |
| **M4 Operator** | 8 | One prompt drives the whole thing |
| **M5 Beta** | 11 | Metrics, credits, billing, landing, onboarding |

M3 is the earliest point at which the product is demo-able as the 2-minute story in `01-product.md`; M4 makes it feel like an "operator".
