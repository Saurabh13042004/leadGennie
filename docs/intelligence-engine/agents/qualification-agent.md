# Qualification Agent (Python)

**Phase:** 2A · **Code:** `app/agents/qualification.py`, `app/scoring/*` · Math: [`../scoring.md`](../scoring.md)

## Purpose
Answer **"Why is this a fit?"** — combine the verified company profile, the person (if any), verified signals, and the workspace ICP into an ICP score, an intent score, and a human-readable, evidence-linked explanation.

```
Company profile + Person + Verified signals + ICP
          ↓
   Attribute normalization (rules → LLM fallback)
          ↓
   Deterministic scoring (icp.py, intent.py)
          ↓
   { icp_score, intent_score, breakdown[], confidence, qualified }
```

## The agent's LLM role is narrow
1. **Attribute normalization:** title → `{seniority, function}`, free-text industry → taxonomy value, size text → band, location → country code. Rules/lookup tables first; the LLM only resolves what rules can't, returning enum values validated against the taxonomy.
2. **Nothing else.** The LLM never produces a score, never edits weights, never decides `met/not_met` — the scoring engine does, from normalized attributes.

## Inputs used
Only **verified** fields/signals (validator output). Unverified data contributes 0 and appears as `unknown` in the breakdown, lowering `confidence`.

## Outputs
```jsonc
{ "scoring_version": "1", "icp": {"score": 91, "confidence": 0.82, "breakdown": [...]},
  "intent": {"score": 87, "breakdown": [...]}, "qualified": true,
  "why_fit": [ { "criterion": "employee_range", "status": "met", "text": "120 employees (target 50–500)", "evidence_ids": ["ev_3"] } ] }
```
`why_fit[].text` is **templated from the breakdown** (no free LLM prose) — so the "Why this lead?" checklist can't drift from the numbers.

## Guarantees
Deterministic given normalized attributes; LLM failure degrades to rules-only with reduced confidence (never blocks scoring); exclusions dominate; the same lead re-scored after an unrelated edit yields the same result.

## Evals
Title/industry normalization accuracy on ~200 labelled examples; golden score table (~40 cases); regression of `scoring_version` bumps (diffs reviewed).
