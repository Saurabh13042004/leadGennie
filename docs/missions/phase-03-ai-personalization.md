# Mission: Phase 3 — AI Personalization

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-03-ai-personalization.md`. Agent spec: `product-agents/campaign-agent.md`.

## Objective
Generate per-lead emails that use only verified evidence, pass deterministic validators, are editable, and are fully audited.

## Preconditions
- [ ] Phase 2 (2A **and** 2B) Done (engine live; verified evidence, signals, `lead_research` incl. `recommended_angle`/`why_now`, `lib/ai/client.ts`)
- [ ] D-02 resolved (paid LLM tier)

## Read first
`lib/ai/messages.ts`, `lib/actions/ai.ts`, `lib/actions/prompts.ts` + `lib/prompts-constants.ts` (published versions, `prohibited_claims`, `required_sources`), `lib/campaigns/personalize.ts`, `message_generations`, Phase 2 evidence code.

## Work packages
1. **WP3.1 Contract & context** — zod output schema; `buildContext()` (verified-only, recency, token-capped); default published prompt "Evidence-backed cold email v1" seeded through the Prompt Library (system default only).
2. **WP3.2 Validators** — pure, table-tested: schema, recipient/company, claim→evidence (incl. claim-vocabulary detector), banned phrases, placeholders, links, length. One-regeneration-with-errors path. *Exit:* a scripted hallucinating `FakeLlm` ("Congrats on the Germany expansion") is rejected 100%.
3. **WP3.3 Storage** — `message_drafts` (+ audit link to `message_generations`), edit history, re-validation on edit (warn, don't block).
4. **WP3.4 Tone/settings** — real `tone` + seniority guidance in prompts; "recent news" toggle wired to verified signals; ensure localization/A-B remain absent.
5. **WP3.5 UI** — preview/edit panel with evidence-linked highlights and validator warnings; single-lead generate on the detail page; bulk generation job + review queue.
6. **WP3.6 Evals** — `scripts/evals/personalization.mjs` with ~30 fixtures; run against the real model; paste results in the report.

## Do NOT
Re-implement research in Next (strategy inputs come from the persisted Outreach Research output) · Send anything · build campaign/sequence UI (Phase 4) · A/B or localization · LinkedIn generation · let a failed validation silently fall back to a draft with unverified claims · weaken validators to make evals pass.

## Verification
Unit + integration tests · eval report (fabricated-claim rate in passing set must be 0; injected hallucinations caught 100%) · view the preview panel with evidence hover on a real researched lead · `npm run verify`.

## STOP and ask if
Evals show the model routinely fabricates despite the prompt (consider model change/D-02) · the claim-vocabulary detector has a high false-positive rate that would block most drafts · Prompt Library approval flow conflicts with seeding a default.

## Report
Format in `docs/missions/README.md`, including the eval table.
