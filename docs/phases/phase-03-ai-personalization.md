# Phase 3 — AI Personalization

## Goal
For each lead, generate a high-quality, **evidence-backed** email: correct recipient and company, no fabricated facts, configurable tone, fully editable by the user.

## Starting point
`lib/ai/messages.ts` drafts a *generic per-audience* step message with `{{first_name}}`/`{{company}}` placeholders (substituted at launch by `lib/campaigns/personalize.ts`). Prompt Library (`prompts`/`prompt_versions`, approval-gated publishing, `draftFromPromptVersion`) and `message_generations` audit exist and are reusable. There is no per-lead input, no evidence, no claim check. Sender positioning comes from `users.pitch` (moved to workspace in Phase 1).

## Design

Strategy comes from the Intelligence Engine's **Outreach Research Agent** (`why_contact`, `why_now`, `why_person`, `potential_problem`, `recommended_angle`, all evidence-linked, verified-only — persisted in `lead_research` in Phase 2B). Phase 3 turns that strategy into copy; it does **not** re-research. Email copy generation stays in Next.js (Campaign Agent + Prompt Library). Optionally, draft claims are re-checked with the engine's `POST /v1/evidence/validate`.

```
Context (lead + company + role)
 + Research (why_contact / why_now / why_person / hypothesis / recommended_angle)  ┐ only VERIFIED evidence
 + Signals (recent, verified)                                                       ┘
 + ICP + workspace positioning + tone settings
        ↓
 Personalization engine (prompt from Prompt Library, published version)
        ↓
 Structured output { subject, body, used_evidence_ids[], claims[], angle }
        ↓
 Validators (schema · recipient/company · claim→evidence · banned phrases · length · unsubscribe/footers)
        ↓
 message draft (status: draft → edited → approved) — never auto-sent
```

## Scope

### WP3.1 — Generation contract
- zod schema: `{ subject, body, angle, used_evidence_ids: number[], personalized_claims: { text, evidence_id }[], confidence }`.
- **Prompt rules (baked into the system prompt of the built-in default and required in library versions via `prohibited_claims`/`required_sources` fields already in `prompt_versions`)**: use only supplied evidence; never invent funding, hires, locations, product features, mutual connections, or metrics; if no strong evidence, write a shorter role/company-relevant note without pretending to know things; no fake urgency; one clear CTA.
- Inputs assembled by `lib/domain/personalization/buildContext()` — the *only* place that decides what evidence reaches the model (verified only, recency-filtered, capped by tokens).

### WP3.2 — Validators (deterministic, unit-tested)
1. Schema valid.
2. Recipient/company correctness: greeting name == lead first name; company mentions match `company.name`; no other real person/company names not in context (named-entity check against context whitelist).
3. **Claim→evidence:** every `personalized_claims[].evidence_id` exists, belongs to this lead/company/workspace, and is `verification.verified` (from the engine's Evidence Validator; optionally re-checked via `POST /v1/evidence/validate` when the evidence is older than N days); body sentences flagged as claims (contain numbers, dates, funding/hiring/expansion vocabulary) must map to a claim entry — otherwise reject.
4. Banned/spammy phrase list, length bounds, no unresolved `{{placeholders}}`, no links other than allowed (unsubscribe/booking).
5. Failure → one regeneration with the validator errors → else mark `failed_validation` with reasons shown to the user (never silently fall back to a hallucinated draft).

### WP3.3 — Storage & audit
- `message_drafts` table (or extend `message_generations`): `lead_id, campaign_id null, step_index, subject, body, used_evidence_ids, claims jsonb, status (draft|edited|approved|rejected|failed_validation), prompt_version_id, model, tokens, generation_id, edited_by, created_at`. Keep the exact prompt/model/inputs for audit (existing CAM-03 behaviour retained).
- Editing a draft preserves the original generation and records diff; edited drafts are **re-validated** (a user edit that adds an unsupported claim shows a warning, not a block — user owns their edits, but the warning is logged).

### WP3.4 — Tone & personalization settings (make the decorative options real or remove)
- Workspace/campaign `tone` (e.g. concise/friendly/formal/direct) + seniority adaptation (rule-based lookup from title seniority → style guidance) — real, wired into the prompt.
- "Insert recent company news" → real toggle: includes verified NEWS/FUNDING signals if present, otherwise no-op with visible reason.
- **Localization and A/B testing stay removed** until they have real behavior (A/B needs Phase 5/9 event data).

### WP3.5 — UI
- **Preview & edit panel** (reused by the campaign builder, Phase 4): shows the email with **highlighted personalized phrases** linking to their evidence (hover → source), tone selector, *Regenerate*, *Edit*, *Approve draft*; warnings list from validators.
- Lead detail page → "Generate email" (single lead) for a sandbox preview without a campaign.
- Bulk: generate drafts for N leads as `personalization` jobs with progress; review queue with filters (needs review / failed validation / approved).

### WP3.6 — Eval harness
`scripts/evals/personalization.mjs`: a fixed set of ~30 lead+evidence fixtures (including *no-evidence*, *contradictory*, *thin* cases) run against the real model on demand; reports hallucination rate (claims without evidence), validator pass rate, average length, tone adherence. Not in CI (cost/flake) but required before changing the default prompt or model.

## Out of scope
Sending, sequencing/follow-up logic (Phase 4/5), A/B testing, localization, LinkedIn message generation (deprecated with D-05), reply drafting (Phase 6).

## Data changes
`0011_message_drafts` (+ `tone` on workspaces/campaigns), seed of a default "Evidence-backed cold email v1" prompt version (published, approval bypass only for the system default).

## Tests
Validator table tests (each rule, pass/fail) · `buildContext` excludes unverified/foreign-workspace evidence · invalid model JSON never persisted · unresolved placeholder rejected · regenerate-once path · edited-draft revalidation · FakeLlm scripted hallucination is caught ("Congrats on your Germany expansion" with no evidence → rejected).

## Acceptance criteria
- [ ] For every generated message: correct recipient + company; **no claim without evidence** (validator-enforced, tested with a hallucinating fake model)
- [ ] Personalized phrases in the preview link to their source evidence
- [ ] Tone is configurable and measurably changes output (eval report attached)
- [ ] User can edit any draft; original generation + audit retained
- [ ] Leads with no evidence get a valid, honest, generic-but-relevant message (not blocked, not fabricated)
- [ ] Bulk generation for 50 leads runs as jobs with progress; failures are per-lead and visible
- [ ] Eval run on the fixture set: **0 fabricated claims** in the passing set; validator catches 100% of injected hallucinations
- [ ] Decorative wizard options are either wired to real behavior or absent
- [ ] `npm run verify` green

## Risks
Validators can't prove *truth*, only *traceability* → evidence quality (Phase 2) is the ceiling; keep evidence snippets in context so the model paraphrases sources rather than inventing.
Claim detection heuristics miss subtle claims → combine keyword rules with an LLM "claim extractor" pass whose output is also schema-validated; log misses from evals.
Prompt cost per lead → cache by (lead, evidence hash, prompt version).

## Exit
Tag `phase-3-complete`. Mission: [`missions/phase-03-ai-personalization.md`](../missions/phase-03-ai-personalization.md).
