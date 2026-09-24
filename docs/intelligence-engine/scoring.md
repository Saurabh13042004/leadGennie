# Scoring — ICP & Intent (deterministic)

`services/intelligence/app/scoring/{icp,intent}.py` — **pure functions**: same input ⇒ same output, no network, no LLM. Exposed synchronously as `POST /v1/score` (so an ICP edit in Next can recompute cheaply without a research run) and used inside runs.

**Single implementation.** Scoring lives *only* in the engine (rule 4: no duplicate logic in TS). Next stores results; it does not recompute them.

## ICP definition (sent as `context.icp`, stored in `workspaces.icp`)

```jsonc
{
  "industries":   [ { "value": "b2b_saas", "weight": 25 } ],
  "employee_range": { "min": 50, "max": 500, "weight": 20 },
  "geographies":  [ { "value": "IN", "weight": 15 } ],
  "titles":       [ { "seniority": ["vp","head","cxo"], "function": ["sales"], "weight": 25 } ],
  "keyword_signals": [ { "keyword": "outbound", "weight": 15 } ],
  "exclusions":   { "industries": [], "domains": [], "titles": [] },
  "min_score_to_qualify": 70
}
```
Weights are normalized to 100. Taxonomies (industry, seniority, function, country) are versioned enums in the engine; Next's ICP form only offers valid values.

## ICP score

For each criterion → `status ∈ {met, partial, not_met, unknown}` from **verified** data only:
- `points = weight × factor`, factor: met = 1, partial = 0.5 (e.g. adjacent industry, size within 25% of range), not_met = 0, **unknown = 0**.
- Exclusion match ⇒ score capped at 10 and breakdown shows `excluded: <reason>`.
- `score = round(Σ points)`, clamp 0–100.
- `confidence = 1 − (Σ weight of unknown criteria / 100) × 0.6` — missing data lowers confidence, never inflates the score, and is displayed as "unknown", not "no".

Attribute extraction (title → seniority/function, industry → taxonomy) is done by rules first (lookup tables/regex), LLM as a structured fallback; on LLM failure, rules-only results are used and `confidence` is reduced. The LLM output is validated against the enum sets.

## Intent score

Only **verified** signals count.
```
points(signal) = type_weight × confidence × recency_factor
recency_factor = 0.5 ^ (age_days / half_life_days)        # default half-life 45 days; per-type override
intent = min(100, Σ points)   with diminishing returns per type: 2nd signal of same type counts ×0.5, 3rd ×0.25
```
Default type weights: FUNDING 25 · HIRING/JOB_POSTING 20 · EXPANSION 20 · LEADERSHIP_CHANGE 15 · PRODUCT_LAUNCH 10 · TECH_CHANGE 10 · NEWS 5. Signals older than `expires_days` (default 180) contribute 0. Weights are config, versioned (`scoring_version` returned in results and stored so historical scores stay explainable).

## Guarantees (unit + property tests)

- Deterministic; monotonic in matched criteria; adding a *verified* relevant signal never lowers intent.
- Exclusions dominate. Unknown never counts as met.
- Unverified evidence has **zero** influence (test: flipping `verified` changes the score).
- Weights normalization: any weights → total 100; no negative weights.
- Golden table: ~40 (company, person, ICP) cases with expected score bands; regression-checked in CI.

## Output

`{ scoring_version, icp: {score, confidence, breakdown[]}, intent: {score, breakdown[]}, qualified: score >= min_score_to_qualify }`. Next writes `leads.icp_score/intent_score`, `lead_research.icp_breakdown`, and an activity `lead.scored` (previous → new, `scoring_version`).
