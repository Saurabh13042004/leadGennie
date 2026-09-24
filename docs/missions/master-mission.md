# LeadGennie V1 — Master Mission (orientation)

> Use this to brief a new agent or teammate on the whole product. **Do not execute it in one pass** — run the per-phase missions in order.

You are working on the existing LeadGennie repository. Your mission across phases is to transform it into a production-ready MVP of an **AI outbound operator**: the user describes who they want to sell to; LeadGennie finds/imports prospects, researches them, qualifies them, identifies buying signals, generates **evidence-backed** personalized outreach, builds email campaigns, sends only approved campaigns, monitors replies, classifies them, and drafts responses that a human approves.

## The loop
Target → Prospects → Enrichment → Research → ICP score → Signals → Evidence → Personalized outreach → Campaign → **User approval** → Email execution → Reply → Classification → AI draft → **Human approval** → Conversation/meeting.

## Architecture in one line
**Next.js runs the business/product; the Python LeadGennie Intelligence Engine investigates the world** — source connectors → extraction → Research/Signal/Qualification/Outreach-Research agents → **Evidence Validator** → deterministic scoring, returning a verified Research Result that Next.js persists. The engine never writes product data or sends email. (`docs/intelligence-engine/`)

## Principles
- Every AI recommendation is explainable: **Why this lead? Why now? Why this message?** with sources. Never fabricate facts.
- Extend the codebase; don't rewrite it. Reuse workspaces/RBAC, approvals, activities, DNC, prompt library, mailboxes/domains, CSV import, Resend.
- Orchestrator + explicit tools, not one giant autonomous prompt. AI proposes; app code validates and mutates.
- Strict multi-tenancy; durable, idempotent jobs; rate-limited, unsubscribe-respecting email; observable, metered agent runs.
- Calm, minimal, dark, transparent UI. Six nav items. No fake metrics anywhere.

## Phases (strict order)
0 Stabilization → 1 Lead foundation → 2 Lead intelligence (2A Python engine, 2B app) → 3 Personalization → 4 Campaign builder → 5 Email engine → 6 Inbox → 7 Chrome extension → 8 Gennie agent → 9 Analytics → 10 Credits → 11 Billing & beta.
Details: `docs/phases/`. Briefs: `docs/missions/phase-NN-*.md`.

## Definition of V1 complete
A new user can sign up, create a workspace, connect email, import leads, run Gennie, see research/ICP/signals/evidence, generate personalized emails, create + review + approve + schedule a campaign, send, receive a reply, see it classified, get a suggested response, approve it, and send it — reliably. (`docs/01-product.md`, `docs/06-quality-and-testing.md` → V1 E2E gate.)

## First task for a new agent
Read `AGENTS.md`, `docs/00-current-state.md`, `docs/README.md`. Then begin at the first phase not marked Done.
