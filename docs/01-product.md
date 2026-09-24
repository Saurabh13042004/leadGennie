# 01 — Product

## Vision (one sentence)

> **LeadGennie is an AI outbound operator that turns a target-customer description into researched prospects, personalized outreach, and qualified conversations.**

Positioning: **"Your AI outbound operator."** Not "another AI lead-gen platform".

Supporting line: *Tell LeadGennie who you want to sell to. It finds the right prospects, researches them, explains why they matter, writes personalized outreach, and manages the follow-up.*

### The differentiator: evidence-backed outbound

Every important AI decision must be able to answer three questions, with sources:

1. **Why this lead?** (ICP fit — industry, size, geography, role)
2. **Why now?** (buying signals — hiring, funding, expansion, launches)
3. **Why this message?** (the angle, tied to a specific signal/evidence)

If the system can't cite evidence for a claim, it must not present the claim as fact, and the email generator must not use it (see Rule 6, PLAN §39).

## Target user

Founders and small B2B sales/GTM teams (1–10 people): SaaS founders, B2B agencies, early-stage startups, sales consultants. They want opportunities without manually finding companies, researching them, finding decision-makers, writing emails, managing follow-ups, and triaging replies.

## How it's built (one paragraph)

**Next.js runs the business/product; a Python "Intelligence Engine" investigates the world.** The engine collects public information (websites, search, news, job pages), reasons over it with a handful of specialized agents, and — crucially — **verifies every claim against sources it actually fetched** before anything reaches a score or an email. Users never see the machinery; they see *why contact this person*, with sources. See `02-architecture.md` and `intelligence-engine/`.

## The core loop (everything else is secondary)

```
Target → Prospects → Evidence → Personalized outreach → Approval
       → Campaign → Replies → Qualified opportunities
```

If a feature doesn't improve this loop, it doesn't ship in V1.

## V1 scope

**Must have**

- *Leads:* CSV import, manual create, extension capture, dedupe, enrichment, scoring, company research, buying signals, lead detail page
- *AI:* natural-language command, agent planning + execution, structured tool calling, qualification, research, personalization, campaign generation, reply classification, reply drafting
- *Campaigns:* email sequences, builder, scheduling, personalization, approval workflow, sending, retries, unsubscribe, bounce handling
- *Inbox:* threads, incoming replies, classification, AI-suggested reply, approve-and-send
- *Analytics:* sent, delivered, bounced, replied, interested, meetings
- *Infra:* durable jobs, agent runs, logging, error handling, usage + credit tracking

**Out of scope for V1 — do not build before the loop works**

Voice calling · WhatsApp · **automated LinkedIn messaging** · full CRM replacement · proprietary lead database · 20+ integrations · complicated workflow builder · enterprise RBAC · forecasting · AI voice agents · custom email infrastructure · complicated billing tiers · mobile app.

> Several of these already exist in the repo (LinkedIn DM sending, Agentic Flows builder, Deals/Tasks, RBAC, HubSpot connect). The rule is: **don't delete working code, don't extend it, hide it from the V1 surface.** See `00-current-state.md` and decision D-05.

## Navigation (six items, no more)

```
LeadGennie
├── Command Center     ← Gennie prompt bar, plan/run UI, today's brief
├── Leads              ← leads, lists/segments, import, lead detail, forms
├── Campaigns          ← list, builder, review/approve
├── Inbox              ← reply threads, classification, suggested replies
├── Analytics          ← funnel + campaign comparison
└── Settings           ← workspace/team, mailboxes & domains, DNC, prompts,
                         integrations, API credentials, usage/credits, approvals
```

Hidden behind a feature flag (routes kept, not linked): Deals, Tasks, Accounts, Agentic Flows, CRM Sync, Meetings, Knowledge, Webhooks, Notifications, Help.

## Command Center

Empty state:

```
Good morning, {firstName}.
What do you want to accomplish?
┌──────────────────────────────────────────────┐
│ Find 100 SaaS founders in India who raised…  │
└──────────────────────────────────────────────┘
                [ Run with Gennie ]
```

Flow: **prompt → plan (with estimate) → user approves → live execution → results**. Details in `product-agents/orchestrator.md`.

- Plan shows numbered steps, estimated record count and credits (once credits exist, Phase 10; before that, estimated LLM calls).
- Execution shows step status (done / running / pending) with **View results · Pause · Cancel**.
- Sending is never part of a run — a run ends by preparing a campaign in `READY` state that awaits approval.

## Safety rules for Gennie (product-level, non-negotiable)

Gennie must never: **invent information**, **send without approval**, **modify unrelated data** (tools are workspace-scoped), **exceed campaign limits** (`daily_limit`, `total_limit`), or **ignore unsubscribe/DNC**.

## UX principles

Calm · Agentic (user gives intent) · Transparent (agent explains itself) · Controllable (user approves important actions) · Evidence-driven · Fast (progress shown immediately) · Minimal (no meaningless charts).

Visual direction: dark mode, clean typography, generous whitespace, subtle borders, minimal gradients, restrained animation, command-center feel. Avoid glassmorphism, neon gradients, giant sparkles, fake live numbers, 20-card screens.

## Landing page

Hero: **"Your AI outbound operator."** — *Find the right prospects, understand why they're a fit, and turn them into conversations.* CTA **Start free**, secondary **Watch Gennie work**.

Replace every fabricated number with a product demonstration. Any demo data must be **visibly labelled "Demo data"**; never present fictional metrics as customer results; no third-party logos that imply customers/endorsement.

## Definition of V1 complete

A brand-new user can, unaided and reliably:

1. Sign up → 2. create workspace → 3. connect email → 4. import leads → 5. run Gennie → 6. research leads → 7. see ICP score → 8. see buying signals → 9. see evidence → 10. generate personalized emails → 11. create campaign → 12. review it → 13. approve → 14. schedule → 15. send → 16. receive a reply → 17. classify it → 18. get a suggested response → 19. approve it → 20. send it.

**The 2-minute demo that proves it:** *"I gave LeadGennie 50 prospects → Gennie researched them → showed me why 31 are good → wrote 31 evidence-backed emails → I approved → it sent them → someone replied → Gennie understood the reply and drafted my response."*

This end-to-end path is the release gate (`06-quality-and-testing.md`, "V1 E2E gate"). Don't wait for anything else; don't ship without it.
