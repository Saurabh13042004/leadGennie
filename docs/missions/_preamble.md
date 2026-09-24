# Mission Preamble (read before every mission)

You are working in the existing **LeadGennie** repository (`/Users/saurabh/Desktop/leadGennie`). You are rebuilding it phase by phase into an AI outbound operator. **This is not a rewrite.**

## 0. Read first
1. `AGENTS.md` — **this is not the Next.js you know.** The app runs Next.js 16.2.6. Before writing any Next.js code (routing, server actions, caching, `proxy.ts`, async request APIs, route handlers), read the relevant guide under `node_modules/next/dist/docs/` and heed deprecation notices. Do not rely on memory of older versions.
2. `docs/00-current-state.md` — what exists, what's reusable, known defects.
3. `docs/04-engineering-rules.md` — the 25 rules and repo conventions.
4. `docs/03-data-model.md` and `docs/02-architecture.md` — target shapes.
5. The phase spec named in your mission, and any `product-agents/*.md` it links.
6. `docs/05-decisions.md` — confirm every decision your phase depends on is **resolved**; if not, STOP and ask.

## 1. Standing rules (abridged — full table in 04)
- Inspect before creating: search for existing code that already does what you need; extend it. No duplicate functionality (no second approvals/activity/status mechanism).
- Preserve working functionality. Hidden ≠ deleted.
- Tenant isolation: every workspace table has `workspace_id`; every query filters by it; every mutation calls `requireRole()`/`requireWorkspace()` (or the job/agent equivalent). Never trust an id from the client without a workspace-scoped lookup.
- AI: structured output → zod validate → retry once → else fail visibly. No raw model text in the DB. No fabricated facts; evidence required. Usage recorded for every LLM/provider call.
- Long-running work = jobs. Jobs idempotent. Sending respects unsubscribe/DNC/limits and never happens from a request handler (from Phase 5).
- Agents never mutate the DB directly and never send email. Sending needs approval (campaign) or an explicit user click (reply).
- No mock/fake data in authenticated flows. Demo data must be labelled "Demo data".
- Stay in phase: do **not** build features belonging to a later phase, even if easy.
- TypeScript strict; no `any` without justification; no `@ts-ignore`.

## 1b. Two runtimes (from Phase 2)
- **Next.js runs the product; the Python Intelligence Engine (`services/intelligence/`) investigates the world** (D-11). Read `docs/intelligence-engine/README.md` before touching either side of the boundary.
- Next.js is the **single writer** of product data; the engine never writes product tables and never sends email. Engine results are **re-validated** (zod + invariants) before persistence. No research/scraping/scoring logic in TypeScript. If the engine is down, show it — never substitute a guess.
- Contract-first: pydantic → OpenAPI → generated TS types + zod mirrors; additive-only within `/v1`. Use `FakeIntelligenceClient` / `ENGINE_FAKE_MODE` in tests; no live network/LLM in default CI.
- Python work: follow `docs/intelligence-engine/development.md` (uv, ruff, mypy strict, pytest, pydantic everywhere, LLM only via `llm/client.py`, budgets checked before external calls). The "read Next.js docs first" rule applies to Next code; for Python, **verify current library docs** (FastAPI, pydantic v2, the Gemini Python SDK, your search provider) instead of relying on memory.
- Verification is `npm run verify` (Next) and, once the engine exists, `npm run verify:all`.

## 2. Repo facts you'll need
- DB: `import { sql } from "@/lib/db/client"` (Neon HTTP driver, tagged templates; `sql.query(text, params)` for dynamic; `sql.transaction([...])` for atomic batches). No ORM.
- `"use server"` modules export **only async functions**. Put shared types/constants/logic in plain `lib/*.ts` (`*-core.ts` pattern). Violating this has broken the Turbopack build before.
- Session `user.id` is a string → `Number()` + NaN guard.
- Significant mutations → `logActivity()`. Approval-gated things → `createApprovalRequest`/`decideApproval`.
- UI: Tailwind 4, `cn()`, lucide, dark theme, existing dashboard shell. Match surrounding density/naming. Keep components < ~300 lines.
- **Other sessions may be editing files.** Re-Read a file right before editing it.
- After changing a page, load the actual rendered page (not just check action JSON) — a page has crashed in prod while its data looked fine.
- Never commit secrets. Don't touch `.env.local` values; document new variables in `.env.example`.
- Commit per work package: `phaseN: <what>`. Commits/PRs only when asked; if not asked, leave changes staged/unstaged and say so in the report.

## 3. Method
1. **Existing-code check** (write it in your report): list the files/tables/components you inspected and what you'll reuse, refactor, or add.
2. Plan the work packages in order; do them one at a time. For each: implement → tests → `npm run typecheck` (and `npm run verify` from Phase 0 on) → run the app and exercise the flow → commit.
3. Write migrations as new numbered files; never edit applied ones. Test on an empty DB **and** on a copy of the current DB.
4. Add/extend the workspace-isolation tests for every new table/route.
5. Update docs you changed the truth of (`00-current-state`, phase status, `CHANGELOG-phases.md`, `05-decisions` outcomes).

## 4. STOP conditions (ask, don't improvise)
- A blocking decision in `05-decisions.md` is unresolved.
- The spec conflicts with the code in a way that needs a product decision.
- You would need to delete or disable working functionality not listed in the phase.
- A change requires production data/credentials you don't have.
- An acceptance criterion cannot be met as written.

## 5. Finish
Do not claim completion unless **every** acceptance criterion in the phase spec passes with evidence. End with the Report in `docs/missions/README.md`.
