<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# LeadGennie — project context for coding agents

LeadGennie is being rebuilt (around the existing code, **not** a rewrite) into an **AI outbound operator**: discover/import prospects → research them → verify evidence → personalize outreach → human approval → send → classify replies → draft responses. **Next.js runs the product; a Python "Intelligence Engine" (`services/intelligence/`) investigates the world.**

## The `docs/` folder is the source of truth — read it before non-trivial work

Start with [`docs/README.md`](docs/README.md): it has the index and the **phase status table** (find the first phase not marked Done — that is the current phase). Then read what your task touches:

| If you are… | Read |
|---|---|
| Starting any task | `docs/README.md`, `docs/00-current-state.md`, `docs/04-engineering-rules.md` |
| Making a product/UX call | `docs/01-product.md` |
| Designing or changing structure (layers, jobs, tenancy, agents, evidence) | `docs/02-architecture.md` |
| Touching the database | `docs/03-data-model.md` (extend existing tables; migrations are numbered, forward-only, in `db/migrations/`) |
| Unsure whether something is decided | `docs/05-decisions.md` (D-01…; never build behind an unresolved blocking decision — ask) |
| Testing/verifying/finishing a phase | `docs/06-quality-and-testing.md` |
| Building a phase | `docs/phases/phase-NN-*.md` (scope, acceptance criteria) and the matching brief `docs/missions/phase-NN-*.md`, preceded by `docs/missions/_preamble.md` |
| Working on research, evidence, scoring, scrapers/connectors, or anything Python | `docs/intelligence-engine/README.md`, `api-contract.md`, `sources.md`, `scoring.md`, `development.md`, `agents/*` |
| Working on Gennie/orchestrator/lead/campaign/inbox agents | `docs/product-agents/*` |

Working rules for using the docs:
1. **Stay in the current phase.** Do not build later-phase features (rule 20). A phase is done only when every acceptance criterion passes with evidence (rule 25).
2. **Docs vs code:** if they disagree, the code is the current truth and the docs are the target — surface the mismatch, don't silently pick one. Update the docs whenever you change what is true (`00-current-state.md`, phase status table in `docs/README.md`, decision outcomes in `05-decisions.md`, `docs/CHANGELOG-phases.md`).
3. **Never guess a decision.** If a blocking decision is `pending`, stop and ask the user.
4. Inspect before creating files; reuse existing code; hide rather than delete working off-strategy features.

## Non-negotiables (full list: `docs/04-engineering-rules.md`)

- Tenant isolation: every workspace table has `workspace_id`; every query filters by it; every mutation calls `requireRole()`/`requireWorkspace()`.
- **No fabricated facts and no mock data in authenticated flows.** Claims need verified evidence. AI output is schema-validated (zod in Next, pydantic in Python) before any write; the LLM proposes, application code disposes.
- Agents never mutate the DB directly and **never send email**; sending needs an approved campaign or an explicit user click. Long-running work = idempotent background jobs. Respect DNC/unsubscribe/limits.
- Next.js is the single writer of product data; the Python engine never writes product tables. No research/scoring logic in TypeScript.
- `"use server"` files export only async functions; shared types/logic live in plain `lib/*.ts` (`*-core.ts` pattern). Re-read a file right before editing it (other sessions edit this repo). After changing a page, load the rendered page, not just the action's JSON.

## Design principles: SOLID and Low-Level Design (apply to all new code, TypeScript and Python)

**SOLID**
- **S — Single responsibility.** One reason to change per module/function/component. Server actions and route handlers only authenticate → validate → call a `lib/domain/*` service → return the envelope. Keep components under ~300 lines; split by responsibility, not by size alone.
- **O — Open/closed.** Add behavior by adding an implementation to a registry, not by editing a growing `if/switch`: agent tools, job handlers, mail/data providers, engine collectors, scoring criteria, signal types, prompt versions.
- **L — Liskov substitution.** Every implementation of an interface honors its full contract, including error semantics (`ResendProvider`, `GmailProvider`, `FakeMailProvider` are interchangeable; the fake engine and the real engine return contract-valid results).
- **I — Interface segregation.** Small, role-specific interfaces (`Collector`, `MailProvider`, `Tool`, `JobHandler`) — never a fat interface whose callers ignore half of it.
- **D — Dependency inversion.** Business logic depends on abstractions and receives dependencies (ctx, clients, clock, id generator) as arguments; it doesn't construct `Resend`, `GoogleGenAI`, or reach for `sql` inside agents. This is what makes fakes and tests possible.

**LLD strategies to use (where variation or a test seam exists — do not over-engineer)**
- **Strategy:** interchangeable algorithms behind one interface (scoring criteria, providers, personalization tone rules).
- **Registry/Factory:** name → implementation lookup for tools and job handlers; unknown name fails closed.
- **Adapter:** wrap every external system (Resend, Gmail, Gemini, search/news APIs, the Intelligence Engine) so the rest of the code sees our types only.
- **State machine:** campaigns, jobs, agent runs, approvals get an explicit transition table; illegal transitions throw and are tested.
- **Command / idempotent handlers:** jobs are serializable commands with idempotency keys; handlers are "make state X true", safe to run twice.
- **Repository / query modules:** SQL lives in `lib/db/*` or domain repositories, never scattered through UI or agents.
- **Template method / pipeline:** staged flows (research run, send pipeline) as ordered stages with a shared context, each independently testable.
- **Result/envelope errors:** typed `AppError` codes → one `{ ok, data | error }` envelope at the edge; no ad-hoc `{ error }` shapes.
- **Value objects & parse-don't-validate:** parse into typed structures at the boundary (zod/pydantic) and pass typed data inward.

Also: prefer composition over inheritance; keep functions small and pure where possible; name things by domain (`Campaign`, `Lead`, `Evidence`), not by mechanism; pull in a pattern only when it removes real duplication or enables a seam — otherwise match the surrounding code's simplicity. Depend inward: UI → actions → domain → repositories/adapters; domain never imports from `app/` or React.

## Verification before you say "done"

`npm run verify` (typecheck + lint + tests + build). Once the Python engine exists: `npm run verify:all`. New tables need a migration, `workspace_id`, indexes and an isolation test; new AI calls need a schema, usage tracking and a fake; new mutations need `requireRole`, workspace-scoped SQL and `logActivity`.

## Git conventions

- Commit only when asked. Small, logical commits; message format `phaseN: <what>` or `docs: <what>` / `fix: <what>`.
- **Do not add `Co-Authored-By` trailers or any "Generated with Claude Code"/AI-attribution lines to commit messages or PR descriptions in this repo.** The user is the sole author of record.
- Never commit secrets (`.env.local` stays ignored; `.env.example` holds names only). Never force-push or rewrite `main` history unless explicitly told to.
