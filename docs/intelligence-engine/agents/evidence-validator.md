# Evidence Validator (Python)

**Phase:** 2A · **Code:** `app/evidence/{validator,matching,confidence}.py` · Endpoint: `POST /v1/evidence/validate`

> This is the product's USP in code. If the LLM says *"Acme recently expanded into the US"*, don't trust it — verify it.

## Purpose
Given **claims** (from Research, Signal, Outreach agents) and the run's **captured documents**, decide for each claim: is there evidence, from which source, with what confidence, and is it **verified**?

```
Claim ─► Evidence (url + snippet) ─► Source (captured doc) ─► Checks ─► Confidence ─► verified = true|false
```

```json
{ "claim": "Acme expanded into the US", "source": "https://…", "confidence": 0.94, "verified": true }
```
`verified=false` ⇒ the claim must **not** appear as a factual statement anywhere downstream (scoring, outreach narrative, generated email).

## Deterministic checks (in order; failing a hard check ⇒ unverified)

| # | Check | Hard? | How |
|---|---|---|---|
| 1 | **URL was fetched by us** | hard | `source_url` ∈ run document set / cache. LLM-supplied URLs that we never fetched are rejected outright (kills fabricated citations) |
| 2 | **Snippet present verbatim** | hard | Normalized (whitespace/case/quotes) substring match of `snippet` in the document text; fuzzy match (≥0.92 token-sort ratio) allowed only for OCR/markup noise, logged as `fuzzy` |
| 3 | **Entity match** | hard | The document is about the target company: domain match (first-party) or company name/alias within the snippet's context window; homonym guard (conflicting domain/HQ ⇒ fail) |
| 4 | **Claim ↔ snippet consistency** | hard | Numbers, dates, named entities, and key verbs in the claim must be supported by the snippet (rule-based extraction: "8" appears, "US"/"United States" appears, funding amounts/currency match). Then an **entailment check** (LLM, structured `{entails: yes|no|partial, reason}`, small/cheap model, temperature 0) — `no` ⇒ unverified, `partial` ⇒ verified only for the supported portion (claim is narrowed) |
| 5 | **Recency** | soft | Source date vs signal-type window (see Signal Agent). Stale ⇒ confidence penalty; beyond `expires` ⇒ unverified-as-current (may remain as historical fact) |
| 6 | **Source tier** | soft | first-party site > reputable news/press release > job board/ATS > aggregator/blog > unknown/SEO farm |
| 7 | **Corroboration** | soft | Independent registrable domains supporting the same claim (bonus, capped) |

## Confidence
```
confidence = clamp01( tier_weight × entailment_factor × recency_factor × (1 + min(0.15, 0.05 × (independent_sources − 1))) )
tier_weight: first_party 0.95 · reputable_news 0.9 · ats/job_board 0.9 · press_release 0.85 · **dated_news 0.75** (news article on an unlisted domain that states its publish date) · news/aggregator 0.6 (undated) · unknown 0.4
entailment_factor: yes 1.0 · partial 0.9 (the narrowed claim is re-checked by the deterministic gate) · no → hard fail
verified = all hard checks pass AND confidence ≥ VERIFY_THRESHOLD (default 0.70)
```
Every verdict returns `checks[]` with pass/fail + notes (why unverified) so the UI/debug page can explain, and evals can audit.

## Where it runs in a research run
1. After **Research** (profile field claims), 2. after **Signal** (candidate signals), 3. after **Outreach** (narrative claims). Scoring and outreach consume only what passed.
Claims are collected as `Claim { id, text, type, evidence_refs[{source_url, snippet}] }` by each agent's output schema — an agent output containing a factual assertion without an evidence ref is rejected at the schema layer *before* reaching the validator.

## Also callable standalone
`POST /v1/evidence/validate` — batch of `{claim, source_url, snippet}` (optionally re-fetching the source, subject to fetch guardrails) → verdicts. Uses: Phase 3 draft-claim recheck; "refresh evidence" action; pre-send freshness recheck for high-stakes claims (optional, later).

## Guarantees (adversarial test suite; target **0 false-verified**)
- Fabricated URL never verifies. Real URL + fabricated snippet never verifies. Real snippet about a *different* company never verifies.
- Claim with a number/date/entity absent from the snippet never verifies.
- Prompt-injection text inside a page can't raise confidence (validator treats page text as data; entailment prompt is delimited; result schema-validated).
- Deterministic parts are pure/unit-tested; the LLM entailment step has a fake for tests, and disagreements between rule checks and LLM resolve to the **stricter** outcome.
- Stable: same document set + claims ⇒ same verdicts (LLM at temperature 0, cached by `(claim_hash, snippet_hash, prompt_version)`).

## Failure modes
Entailment LLM unavailable → claims needing it are `verified=false` with note `entailment_unavailable` (fail closed); paywalled/blocked source → not fetched ⇒ not verifiable; multi-language sources → allowed if the engine can translate for the entailment step, otherwise `unverified: language`.

## Evals
Adversarial corpus (~150 cases): fabricated URL; correct URL wrong snippet; paraphrase-true; paraphrase-false (number changed); homonym company; stale news presented as current; contradictory sources; injection-laden page; partial support. Metrics: **false-verified rate (must be 0)**, false-unverified rate (tracked, target < 15%), agreement between rule and LLM checks.

## As built (Phase 2A) — deviations and findings

- **Tier `dated_news` (0.75) added.** With the original tiers a dated article on an unlisted news site (0.6) could never reach the 0.70 threshold even with corroboration (cap +0.15 needs 4 sources), so legitimate coverage was structurally unverifiable.
- **Partial entailment factor 0.9 (was 0.8).** A partial verdict only verifies the *narrowed* claim, and that narrowed claim must itself pass the deterministic consistency gate; 0.8 double-penalised press releases (0.85 × 0.8 = 0.68 < 0.70).
- **Homonym guard is headquarters-based, not "any other country".** A third-party page fails entity match only if it says the company is **based in** a different country ("based in Boston, USA", "Boston-based", "(Boston, USA)"). Naming another country as an expansion destination ("opened an office in Austin") is *not* a conflict — the first version treated it as one and wrongly rejected cross-border expansion news. The entailment prompt also carries `COMPANY: name (domain), based in location` and instructs "differently-named company (e.g. Acme Robotics vs Acme) ⇒ no".
- **Job boards prove identity only via the claimed company's own site.** `RawDocument.metadata.linked_from` (set by the jobs collector) must be on the *same registrable domain as the claim's company*. The first version accepted any linked board — the generated adversarial corpus caught Acme verifying against Globex's board.
- **Known limit:** a homonym page with no location/domain cue ("Acme Robotics raised $30M") is caught only by the entailment judge, not by rules. Mitigations: entity-aware entailment prompt, tiers (unlisted third parties can't reach the threshold alone), and corpus tracking. This is the residual risk to watch in live evals.
- **Measured (fake LLM):** `tests/evals/` — hand-written 25 cases + generated corpus of **215 negatives / 30 positives**: **0 false-verified** (even with a sycophantic judge that answers "yes" to everything), **0 false-unverified**. Live: 17/17 first-party claims verified on a real site with gpt-4o-mini; a live adversarial run against real pages is still to do (`make smoke`).
