# Outreach Research Agent (Python)

**Phase:** 2A · **Code:** `app/agents/outreach.py`

## Purpose
Everything discovered → **why contact, why now, why this person, the likely problem, and the recommended angle** — the strategic input to personalization (Phase 3). It does **not** write the email; the Campaign Agent (Next.js, Prompt Library) does.

```
Verified profile + person + verified signals + ICP + workspace positioning
                         ↓
              Outreach Research Agent
                         ↓
 why_contact · why_now · why_person · potential_problem (hypothesis) · recommended_angle · evidence_ids
                         ↓
              Evidence Validator (re-checks narrative claims)
```

## Inputs
**Verified-only** evidence and signals, the person (title/function), ICP fit breakdown, `positioning` and `offer_keywords`. Unverified items are not even passed to the model.

## Output (zod/pydantic)
```ts
Outreach = {
  insufficient_evidence: boolean,
  why_contact: string,        // relevance of the company to the offer, evidence-linked
  why_now: string,            // tied to specific verified signals; if none: "No recent verified triggers found"
  why_person: string,         // role/function relevance (from title/evidence), not personal guesses
  potential_problem: string,  // explicitly a hypothesis; phrased as "may…"
  recommended_angle: string,  // one angle, tied to a verified signal or role pain
  evidence_ids: string[],     // every id must be verified
  avoid: string[]             // things not to say (e.g. unverified rumors, sensitive topics)
}
```

## Rules
1. **Every sentence that states a fact must be traceable to `evidence_ids`.** `potential_problem` and part of `recommended_angle` are hypotheses and are labelled as such in the UI.
2. If verified evidence is thin: `insufficient_evidence=true`, `why_now` says so, and the angle falls back to role/industry relevance from the ICP + positioning — never invents a trigger.
3. No personal-life inferences, no sensitive attributes, no "I saw you…" claims unless a verified source states it.
4. The output's own claims are re-validated by the Evidence Validator (narrative claim → evidence). Sentences that fail are removed and logged, and the field regenerated once; if it still fails, `insufficient_evidence=true`.
5. Angle must relate the *workspace's offer* to the *verified situation*; if positioning is empty, return `angle` generic and add `warnings: missing_positioning`.

## Example (maps to the UI)
> **Why now:** Acme has 8 open SDR roles (careers page) and announced a US expansion (press release, 12 Sep 2026). **Why Sarah:** VP Sales — owns sales development. **Potential problem (hypothesis):** rapid SDR growth may strain pipeline efficiency. **Angle:** improving qualified pipeline per SDR. **Evidence:** 3 verified sources.

## Failure modes
Over-eager narrative → validator strips; conflicting signals → mention both or omit; missing person context → company-level angle only; LLM quota → outreach omitted, rest of result still returned (`warnings: outreach_unavailable`).

## Evals
Fixtures: rich evidence, one weak signal, zero evidence, contradictory evidence, positioning missing. Metrics: unsupported-sentence rate after validation (must be 0), angle relevance (human-rated sample), hypothesis labelling compliance.
