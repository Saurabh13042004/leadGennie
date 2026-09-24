# Signal Agent (Python)

**Phase:** 2A · **Code:** `app/agents/signal.py`

## Purpose
Detect **buying signals** from collected evidence: FUNDING, HIRING, JOB_POSTING, EXPANSION, PRODUCT_LAUNCH, LEADERSHIP_CHANGE, TECH_CHANGE, NEWS. It proposes *candidate* signals with evidence references; the Evidence Validator decides which are verified.

## Inputs
Extracted `Event[]` and `JobPosting[]`, `CompanyProfile`, request context (`icp`, `offer_keywords`), the run's document set. No fetching.

## Detection rules (deterministic criteria first, LLM classification second)

| Type | Minimum criteria for a *candidate* | Recency window |
|---|---|---|
| HIRING / JOB_POSTING | ≥1 job posting URL fetched (careers page or ATS) with role/function/location. "Hiring 8 SDRs" requires counting distinct open roles from fetched postings — counts come from extraction, never from a model estimate | postings ≤ 60 days or currently listed |
| FUNDING | A dated article/announcement naming the company and round/amount; date stated in source | ≤ 18 months |
| EXPANSION | Explicit statement (new office/market/region/team) in a dated source. **Never inferred from absence or from hiring alone** | ≤ 12 months |
| PRODUCT_LAUNCH | Launch/release post/press item with a stated date | ≤ 12 months |
| LEADERSHIP_CHANGE | Dated announcement of a named hire/departure in a senior role | ≤ 12 months |
| TECH_CHANGE | Explicit stack mention (job posting requirements, engineering blog, docs) tied to `offer_keywords` | ≤ 12 months |
| NEWS | Dated reputable-source article about the company relevant to the ICP/offer | ≤ 6 months |

## Output
```ts
CandidateSignal = { type, title, description, detected_at (source date, not run date), evidence_ids[], rationale, relevance_to_offer }
```
- A candidate without ≥1 evidence id is dropped.
- `detected_at` is the **source's date**; if the source has no date, the candidate is emitted with `detected_at=null` and a lower prior (validator may still verify it but recency scoring treats it as old).
- Dedupe by `(type, canonical source URL / normalized title)`; same fact in multiple sources → one signal, multiple evidence ids (corroboration).
- Contradictions (e.g. layoffs vs "rapid hiring") → both emitted, flagged `conflicts_with`.

## Prompt rules (`llm/prompts/signal/v1.py`)
- Classify only from provided events/postings; state the quote (`source_span`) supporting the classification.
- "Do not infer. If the material doesn't state it, it is not a signal."
- Numbers (e.g. 8 SDRs) must be copied from extraction outputs, not computed by the model.

## Failure modes
Stale press (old funding presented as new) → recency window + date requirement; marketing fluff ("we're growing fast") → not a signal without a concrete stated fact; job board duplicates → dedupe by title+location+URL.

## Evals
Fixtures with: real hiring page (count known), stale funding article, undated blog post, "expanding soon" vague copy, contradictory news, keyword-stuffed SEO page. Metrics: precision of verified signals vs labels, zero signals without evidence, date accuracy.
