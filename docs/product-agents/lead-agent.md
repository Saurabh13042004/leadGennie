# Lead Agent (Next.js side)

**Phase:** 2B (research/score tools) · 8 (discovery/people, import) · **Code:** `lib/agent/agents/lead.ts`, `lib/agent/tools/lead/*`, `lib/intelligence/*`
**Tools:** `search_companies`, `search_people`, `get_company`, `get_person`, `enrich_lead`, `research_company`, `find_buying_signals`, `score_lead`

## Purpose
Everything about *finding and understanding leads*, as seen from the product. The Lead Agent is a thin, product-side coordinator: it turns orchestrator steps into **Intelligence Engine runs**, persists validated results through domain services, and enforces workspace scope, approvals and credits. The actual investigation happens in Python — see [`../intelligence-engine/`](../intelligence-engine/README.md).

```
Orchestrator step (tool call, workspace-scoped ctx)
   └─► Lead Agent tool
         ├─ build request from DB (company/lead + workspace ICP/positioning)      ← only place workspace data leaves for the engine
         ├─ enqueue job → IntelligenceClient.createRun(idempotencyKey) → poll
         ├─ zod-validate Research Result
         └─ persist via domain services (companies, signals, evidence, lead_research, scores) + usage + trace
```

## Tools → engine mapping

| Tool | Engine call | Persisted to |
|---|---|---|
| `research_company` | `POST /v1/runs` `company_research` | `companies` fields (+ field provenance), `signals`, `evidence` |
| `find_buying_signals` | `POST /v1/runs` `find_signals` (or reuse from a recent company run) | `signals`, `evidence` |
| `score_lead` | `POST /v1/score` (sync) | `leads.icp_score/intent_score`, `lead_research.icp_breakdown` |
| `research_lead` (used by the UI/agent) | `POST /v1/runs` `lead_research` | all of the above + `lead_research` (why contact/now/person/angle) |
| `search_people` / `search_companies` | `POST /v1/runs` `find_people` / `discover` (Phase 8, needs D-03 connector) | `prospect_candidates` (not leads yet) |
| `get_company` / `get_person` | none (DB reads) | — |
| `enrich_lead` | Runs `company_research`, then applies **only verified fields to blank lead/company fields** | lead/company updates + `field_provenance` |

## Rules
1. **`/v1/capabilities` is the source of truth for what's possible.** If a connector/provider isn't configured, the tool returns `NOT_CONFIGURED` and the planner omits that step. The agent never invents prospects, people, or signals.
2. **Candidates are not leads.** Discovery results land in `prospect_candidates`; conversion to leads goes through the Phase 1 import service (dedupe, email validation, DNC flagging) after user/plan approval.
3. **Enrichment only fills blanks**, only from verified evidence, never overwrites user-entered values; conflicts become suggestions. No email guessing (pattern generation) in V1 — emails come from the user or a licensed provider.
4. **Persistence is defensive:** the Next side re-validates the Research Result (zod), re-checks invariants (every `evidence_ids` resolves, source URLs present, unverified items not used in `lead_research`/scores), and rejects/quarantines a payload that violates them (`dead` job with the engine `run_id`). Trust the engine's *verdicts* only as far as the invariants hold.
5. **Idempotent:** key `research:{workspaceId}:{companyId|leadId}:{researchVersion}`; company-level results are cached/reused across leads at the same company for `freshness_days` (0 credits when reused).
6. **Metered:** every run's `usage[]` becomes `usage_records`; estimates come from `capabilities`/budgets before execution.
7. **Engine down ≠ guess.** Retry with backoff; surface "Research engine unavailable"; never substitute an LLM answer generated inside Next.
8. **Scoped:** the engine gets *no* workspace identifier for authorization; it cannot read or write product data. Cross-workspace access is impossible by construction.

## Failure modes
| Failure | Behavior |
|---|---|
| Engine `QUOTA_EXCEEDED` | job fails with visible message; run pausable/resumable; no partial writes |
| Engine returns partial (`budget_exhausted`) | persist verified subset, mark `research_status='partial'`, show what's missing |
| Invariant violation in result | quarantine (dead job), alert, no data written |
| Homonym/ambiguous entity warning | persist as `unverified`, surface "Is this the right company?" confirmation for the user |

## Evals
Uses the engine's fixtures via `FakeIntelligenceClient`: persistence maps every field/evidence correctly; invariant-violating payloads are rejected; partial results handled; NOT_CONFIGURED plans; no cross-workspace leakage (isolation test).
