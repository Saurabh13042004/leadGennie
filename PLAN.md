Absolutely. I’d treat this as a **product rebuild around the existing LeadGennie codebase, not a rewrite**. Below is a coding-agent-ready PRD with explicit phases, acceptance criteria, architecture, database entities, agent behavior, UX, and shipping order.

# LeadGennie V1 — Product Requirements Document

**Version:** 1.0
**Objective:** Transform LeadGennie from an outbound dashboard into an **AI outbound operator** that discovers, researches, qualifies, personalizes, executes, and manages B2B prospecting campaigns.

---

# 1. Product Vision

### One sentence

> **LeadGennie is an AI outbound operator that turns a target customer description into researched prospects, personalized outreach, and qualified conversations.**

The core experience should be:

```text
User:
"Find SaaS companies in India with 50–500 employees
that are hiring salespeople, find their VP Sales,
and prepare an outreach campaign."

                         ↓

                    LEADGENNIE

                 ┌───────────────┐
                 │ Discover      │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Enrich        │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Research      │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Qualify       │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Personalize   │
                 └───────┬───────┘
                         ↓
                 ┌───────────────┐
                 │ Campaign      │
                 └───────┬───────┘
                         ↓
                    HUMAN APPROVAL
                         ↓
                      SEND
                         ↓
                      REPLY
                         ↓
                 ┌───────────────┐
                 │ Inbox Agent   │
                 └───────┬───────┘
                         ↓
                  Qualified meeting
```

---

# 2. Product Positioning

Do **not** position LeadGennie as:

> "Another AI lead generation platform."

Position it as:

# **Your AI outbound operator**

Supporting statement:

> Tell LeadGennie who you want to sell to. It finds the right prospects, researches them, explains why they matter, creates personalized outreach, and manages the follow-up.

### Differentiator

## Evidence-backed outbound

Every important AI decision should answer:

**Why this lead?**

**Why now?**

**Why this message?**

For example:

```text
ICP Score: 91

Why this lead?
✓ SaaS company
✓ 120 employees
✓ India
✓ VP Sales identified

Why now?
✓ Hiring 5 SDRs
✓ Recently expanded into US

Why this message?
✓ Their expansion suggests outbound capacity is increasing

Evidence
→ Company careers page
→ Company website
→ Public announcement
```

---

# 3. Target User

### Primary ICP

**Founders and small B2B sales/GTM teams**

Especially:

* SaaS founders
* B2B agencies
* early-stage startups
* sales consultants
* small outbound teams
* 1–10 person sales teams

### Initial use case

A user wants to generate outbound opportunities without manually:

* finding companies
* researching them
* finding decision makers
* writing emails
* managing follow-ups
* classifying replies

---

# 4. Core Product Loop

The entire product must optimize for:

```text
Target
  ↓
Prospects
  ↓
Evidence
  ↓
Personalized outreach
  ↓
Approval
  ↓
Campaign
  ↓
Replies
  ↓
Qualified opportunities
```

Everything that doesn't improve this loop is secondary.

---

# 5. V1 Scope

## MUST HAVE

### Lead management

* CSV import
* manual lead creation
* Chrome extension import
* lead deduplication
* lead enrichment
* lead scoring
* company research
* buying signals
* lead detail page

### AI

* natural language command
* agent planning
* agent execution
* structured tool calling
* lead qualification
* research
* personalization
* campaign generation
* reply classification
* reply drafting

### Campaigns

* email sequences
* campaign builder
* scheduling
* personalization
* approval workflow
* sending
* retries
* unsubscribe handling
* bounce handling

### Inbox

* threads
* incoming replies
* classification
* AI suggested reply
* approval/send

### Analytics

* sent
* delivered
* bounced
* replied
* interested
* meetings

### Infrastructure

* durable jobs
* agent runs
* logging
* error handling
* usage tracking
* credit tracking

---

# 6. Explicitly OUT OF SCOPE for V1

Do NOT build these before the core loop works:

* voice calling
* WhatsApp automation
* automated LinkedIn messaging
* full CRM replacement
* massive proprietary lead database
* 20+ integrations
* complicated workflow builder
* enterprise RBAC
* advanced forecasting
* AI voice agents
* custom email infrastructure
* complicated billing tiers
* mobile app

---

# 7. Product Navigation

The application should have:

```text
LeadGennie

├── Command Center
├── Leads
├── Campaigns
├── Inbox
├── Analytics
└── Settings
```

Avoid adding 15 different navigation items.

---

# 8. Command Center

This is the heart of LeadGennie.

### Empty state

```text
Good morning, Saurabh.

What do you want to accomplish?

┌─────────────────────────────────────────────┐
│ Find 100 SaaS founders in India who raised │
│ funding recently                            │
└─────────────────────────────────────────────┘

              [ Run with Gennie ]
```

---

# 9. Agent Planning

Before executing expensive actions, Gennie should explain its plan.

Example:

```text
I'll do this:

1. Find SaaS companies in India
2. Filter to 50–500 employees
3. Identify relevant decision makers
4. Research recent buying signals
5. Score prospects against your ICP
6. Generate personalized outreach

Estimated:
100 prospects
~350 credits

              [Run]
```

User must approve execution.

---

# 10. Agent Execution UI

During execution:

```text
Gennie is working

✓ Understanding ICP
✓ Discovering companies
✓ Filtering companies
✓ Finding decision makers
● Researching buying signals
○ Generating personalization
○ Preparing campaign
```

Allow:

**View results**

**Pause**

**Cancel**

---

# 11. Agent Architecture

Do NOT build one giant autonomous prompt.

Use an orchestrator + deterministic tools.

```text
                    Agent Orchestrator
                           │
        ┌──────────────────┼──────────────────┐
        ↓                  ↓                  ↓
 Discovery             Research           Campaign
 Agent                  Agent              Agent
        │                  │                  │
        ↓                  ↓                  ↓
 Enrichment            Qualification       Email
 Agent                  Agent              Engine
                           │
                           ↓
                     Inbox Agent
```

---

# 12. Agent Tools

Define explicit tools.

```text
search_companies()
search_people()
get_company()
get_person()
enrich_lead()
research_company()
find_buying_signals()
score_lead()
generate_email()
create_campaign()
preview_campaign()
schedule_campaign()
pause_campaign()
classify_reply()
draft_reply()
send_reply()
```

AI should never directly mutate arbitrary database records.

---

# 13. Agent Execution Contract

Every agent execution should produce structured output.

Example:

```json
{
  "run_id": "...",
  "status": "completed",
  "task": "research_lead",
  "result": {
    "score": 91,
    "signals": [],
    "recommendation": "..."
  },
  "usage": {
    "input_tokens": 1234,
    "output_tokens": 456
  }
}
```

Validate every AI response before writing it to the database.

---

# 14. Database Architecture

Create/standardize these core entities.

### User

```text
id
email
name
created_at
```

### Workspace

```text
id
name
owner_id
created_at
```

### WorkspaceMember

```text
workspace_id
user_id
role
```

---

# 15. Lead

```text
Lead

id
workspace_id

first_name
last_name
email
phone
job_title
linkedin_url

company_id

source
source_url

status

icp_score
intent_score

created_at
updated_at
```

---

# 16. Company

```text
Company

id
workspace_id

name
domain
linkedin_url

industry
employee_count
location

description

created_at
updated_at
```

---

# 17. LeadResearch

```text
LeadResearch

id
lead_id

summary
pain_hypothesis
recommended_angle

research_status

created_at
updated_at
```

---

# 18. Signal

```text
Signal

id
lead_id
company_id

type
title
description

source_url
source_type

confidence

detected_at
```

Examples:

```text
FUNDING
HIRING
EXPANSION
PRODUCT_LAUNCH
LEADERSHIP_CHANGE
TECH_CHANGE
JOB_POSTING
NEWS
```

---

# 19. Evidence

Critical for the product's differentiation.

```text
Evidence

id

lead_id
company_id

claim
source_url
source_title

source_type
captured_at
```

Never allow AI-generated facts to appear as verified facts without evidence.

---

# 20. Campaign

```text
Campaign

id
workspace_id

name
status

audience_definition

created_by

started_at
completed_at
```

Statuses:

```text
DRAFT
READY
RUNNING
PAUSED
COMPLETED
FAILED
```

---

# 21. Sequence

```text
Sequence

id
campaign_id
name
```

### SequenceStep

```text
id
sequence_id

step_number

channel
delay_days

subject_template
body_template

status
```

V1 channel:

```text
EMAIL
```

Later:

```text
LINKEDIN
TASK
```

---

# 22. CampaignLead

```text
CampaignLead

id
campaign_id
lead_id

status
current_step

next_action_at

entered_at
completed_at
```

---

# 23. Message

```text
Message

id

workspace_id
campaign_id
lead_id

thread_id

direction
channel

subject
body

status

sent_at
delivered_at
opened_at
replied_at
```

---

# 24. InboxThread

```text
InboxThread

id

workspace_id
lead_id
campaign_id

status

classification

last_message_at
```

Classification:

```text
INTERESTED
NOT_INTERESTED
QUESTION
MEETING_REQUEST
OUT_OF_OFFICE
UNSUBSCRIBE
BOUNCE
OTHER
```

---

# 25. AgentRun

This is mandatory.

```text
AgentRun

id
workspace_id
user_id

type

input
plan
output

status

started_at
completed_at

error

tokens_used
credits_used
```

---

# 26. Activity

```text
Activity

id
workspace_id

actor_type
actor_id

action
entity_type
entity_id

metadata

created_at
```

Useful for debugging and auditability.

---

# 27. Phase 0 — Codebase Stabilization

### Goal

Make the existing project safe to extend.

### Tasks

* inspect existing database schema
* remove duplicated models
* establish workspace ownership
* standardize API responses
* standardize error handling
* standardize environment variables
* add validation layer
* split oversized components
* remove mock metrics from authenticated product
* remove dead code
* add logging
* add basic tests

### Acceptance criteria

```text
✓ Existing authentication works
✓ Existing dashboard works
✓ Database migrations work from clean DB
✓ No fake metrics in real workspace
✓ API errors are structured
✓ TypeScript build passes
✓ Lint passes
```

---

# 28. Phase 1 — Lead Foundation

### Goal

Create a reliable lead system.

### Features

#### CSV import

Support:

```text
first_name
last_name
email
company
company_domain
job_title
linkedin_url
```

Automatically map common column names.

### Import flow

```text
Upload
 ↓
Preview
 ↓
Map columns
 ↓
Validate
 ↓
Deduplicate
 ↓
Import
```

### Acceptance criteria

User can import 1000 leads without crashing.

Duplicate leads are detected.

Invalid emails are flagged.

---

# 29. Phase 2 — Lead Intelligence

### Goal

Turn raw leads into useful leads.

Implement:

```text
Company research
Lead research
ICP scoring
Buying signals
Evidence
```

### Lead detail page

```text
Sarah Chen
VP Sales @ Acme

ICP Score
91

Company
120 employees
B2B SaaS
India

Why this lead?

✓ Matches target industry
✓ Company size matches
✓ Decision-maker role
✓ Recently hiring salespeople

Buying signals
─────────────────
🔥 Hiring SDRs
🔥 US expansion

Research
─────────────────
...

Recommended angle
─────────────────
...
```

---

# 30. Phase 3 — AI Personalization

### Goal

Generate high-quality, evidence-backed messages.

For each lead:

```text
Context
+
Research
+
Signals
+
ICP
+
Product positioning
        ↓
Personalization engine
        ↓
Email
```

Prompt must explicitly prohibit unsupported claims.

### Acceptance criteria

For every generated message:

* correct recipient
* correct company
* no fabricated facts
* evidence-backed personalization
* configurable tone
* editable by user

---

# 31. Phase 4 — Campaign Builder

Build:

```text
Campaign
 ↓
Audience
 ↓
Sequence
 ↓
Personalization
 ↓
Preview
 ↓
Approval
 ↓
Launch
```

### Campaign builder

```text
Campaign name

Audience
[ 100 leads ]

Sequence

Day 0
Email

Day 3
Email

Day 7
Email

Day 12
Email
```

Allow users to edit every step.

---

# 32. Phase 5 — Email Execution Engine

This is where you need reliability.

Architecture:

```text
Campaign
 ↓
Scheduler
 ↓
Job Queue
 ↓
Email Worker
 ↓
Provider
 ↓
Delivery Event
 ↓
Database
```

Do not rely on a single long-running HTTP request.

### Required

* retries
* idempotency
* rate limiting
* scheduling
* cancellation
* pause
* unsubscribe
* bounce handling
* provider errors
* dead-letter/error state

---

# 33. Phase 6 — Inbox

### Inbox UI

```text
Inbox

Interested             4
Needs response         7
Questions              12
Other                  3
```

Thread:

```text
Sarah — Acme

Sarah:
Sounds interesting.
Can you send pricing?

────────────────────

Gennie suggestion:

"Absolutely. We have..."

[Edit] [Send]
```

Never automatically send an AI reply in V1 without explicit user approval.

---

# 34. Phase 7 — Chrome Extension

Use the extension as a lead capture mechanism.

### User workflow

User visits a prospect page.

Clicks:

**Add to LeadGennie**

Extension extracts available information.

```text
Sarah Chen
VP Sales

Acme
acme.com

[Add Lead]
```

Then:

```text
✓ Added to LeadGennie
```

Optional:

**Research with Gennie**

---

# 35. Phase 8 — Gennie Agent

Only now connect all capabilities.

User:

> Find 50 SaaS founders in Bangalore and prepare an outbound campaign.

Gennie:

```text
I can do that.

Plan:

1. Find SaaS companies
2. Filter Bangalore
3. Identify founders
4. Research companies
5. Score leads
6. Generate outreach
7. Prepare campaign

[Run]
```

Then execute.

---

# 36. Phase 9 — Analytics

Don't overbuild analytics.

### Dashboard

```text
Outbound performance

Sent             1,248
Delivered        1,201
Replies            87
Interested         31
Meetings           14
```

### Funnel

```text
Leads
 ↓
Contacted
 ↓
Delivered
 ↓
Replied
 ↓
Interested
 ↓
Meeting
```

### Campaign comparison

```text
Campaign          Leads   Reply   Interested
SaaS founders      100     9%       4%
Agencies           150     7%       3%
Fintech             80     11%      6%
```

---

# 37. Phase 10 — Usage & Credits

Introduce credits only once the core functionality works.

Track:

```text
Discovery
Research
Enrichment
AI generation
```

Example:

```text
Credits

Available: 4,820

Research lead       2 credits
Enrich lead         3 credits
AI personalization  1 credit
```

Every expensive operation should create a usage record.

---

# 38. Phase 11 — Billing

After beta users actually use the product.

Do not spend significant engineering time here before product validation.

Potential model:

```text
Free
        limited leads

Pro
        monthly credits

Team
        shared workspace
        more credits
```

Pricing should ultimately be based on **value / usage**, not simply "AI tokens."

---

# 39. Safety / Reliability Rules for Gennie

The agent must never:

### Invent information

Bad:

> "I saw your recent expansion into Germany."

when there is no evidence.

### Send without approval

V1 requires campaign approval.

### Modify unrelated data

Agent tools must be scoped to workspace.

### Exceed campaign limits

Every campaign has:

```text
daily_limit
total_limit
```

### Ignore unsubscribe

Unsubscribed leads must never receive another campaign email.

---

# 40. API Structure

Use clear domains.

```text
/api/leads
/api/leads/import
/api/leads/:id
/api/leads/:id/research
/api/leads/:id/score

/api/companies
/api/companies/:id

/api/campaigns
/api/campaigns/:id
/api/campaigns/:id/preview
/api/campaigns/:id/launch
/api/campaigns/:id/pause

/api/inbox
/api/inbox/:threadId
/api/inbox/:threadId/draft

/api/agent/run
/api/agent/:runId

/api/analytics

/api/integrations
```

---

# 41. Background Jobs

Create queues/jobs for:

```text
lead_enrichment
company_research
lead_scoring
personalization
campaign_send
campaign_followup
email_sync
reply_classification
analytics_aggregation
```

Every job must be:

* retryable
* idempotent
* observable
* cancellable where appropriate

---

# 42. Observability

Every agent execution should log:

```text
run_id
workspace_id
user_id
agent
tool
duration
status
tokens
credits
error
```

Build an internal debug page eventually:

```text
Agent Runs

Run #12491
Task: Research leads
Status: completed
Duration: 14.2 sec
Credits: 42

Tools:
✓ search_companies
✓ research_company
✓ find_people
✓ score_leads
```

This will save you enormous debugging time.

---

# 43. UX Principles

LeadGennie should feel:

### Calm

Not 50 glowing AI cards.

### Agentic

User gives intent.

### Transparent

Agent explains what it is doing.

### Controllable

User approves important actions.

### Evidence-driven

AI claims have sources.

### Fast

Show progress immediately.

### Minimal

Don't create a dashboard full of meaningless charts.

---

# 44. Visual Direction

Use:

* dark mode
* clean typography
* generous whitespace
* subtle borders
* minimal gradients
* restrained animation
* command-center feel

Avoid:

* excessive glassmorphism
* neon gradients everywhere
* giant AI sparkles
* fake live numbers
* 20 cards on one screen
* generic "AI SaaS" visual language

---

# 45. Landing Page

Replace fake metrics with actual product demonstrations.

Hero:

# **Your AI outbound operator.**

> Find the right prospects, understand why they're a fit, and turn them into conversations.

CTA:

**Start free**

Secondary:

**Watch Gennie work**

---

# 46. Landing Page Demo

Show:

```text
User:

Find 50 SaaS companies in India
that are hiring salespeople.

Gennie:

✓ 312 companies discovered
✓ 87 ICP matches
✓ 63 decision makers found
✓ 41 buying signals
✓ 50 personalized messages

[Review prospects]
```

Use demo data clearly labelled as demo data.

Never make fictional metrics look like actual customer results.

---

# 47. Definition of V1 Complete

LeadGennie is considered **V1 complete** only when a new user can:

```text
SIGN UP
  ↓
CREATE WORKSPACE
  ↓
CONNECT EMAIL
  ↓
IMPORT LEADS
  ↓
RUN GENNIE
  ↓
RESEARCH LEADS
  ↓
SEE ICP SCORE
  ↓
SEE BUYING SIGNALS
  ↓
SEE EVIDENCE
  ↓
GENERATE PERSONALIZED EMAILS
  ↓
CREATE CAMPAIGN
  ↓
REVIEW CAMPAIGN
  ↓
APPROVE
  ↓
SCHEDULE
  ↓
SEND
  ↓
RECEIVE REPLY
  ↓
CLASSIFY REPLY
  ↓
GENERATE REPLY
  ↓
USER APPROVES
  ↓
SEND RESPONSE
```

If that works reliably, **ship it.**

Do not wait for every future feature.

---

# 48. Recommended Shipping Order

Give your coding agent these milestones sequentially:

```text
PHASE 0
Codebase stabilization
        ↓
PHASE 1
Lead ingestion
        ↓
PHASE 2
Lead intelligence
        ↓
PHASE 3
AI personalization
        ↓
PHASE 4
Campaign builder
        ↓
PHASE 5
Email execution
        ↓
PHASE 6
Inbox
        ↓
PHASE 7
Chrome extension
        ↓
PHASE 8
Gennie agent
        ↓
PHASE 9
Analytics
        ↓
PHASE 10
Credits
        ↓
PHASE 11
Billing
        ↓
BETA LAUNCH
```

---

# 49. Coding-Agent Rules

Put these rules at the top of the implementation task.

```text
LEADGENNIE ENGINEERING RULES

1. Do not rewrite the application.
2. Inspect the existing implementation before creating new files.
3. Reuse existing components, database models and utilities where appropriate.
4. Do not introduce duplicate functionality.
5. Do not use mock data in authenticated production workflows.
6. Never fabricate AI-generated company or prospect information.
7. AI output must use structured schemas.
8. Validate all AI output before database writes.
9. All workspace data must be tenant-isolated.
10. All mutations must verify workspace ownership.
11. Long-running work must use background jobs.
12. Background jobs must be idempotent.
13. Email sending must be rate-limited.
14. Email sending must respect unsubscribe state.
15. AI agents cannot directly execute arbitrary database mutations.
16. Use explicit tools for agent actions.
17. Important external actions require user approval in V1.
18. Every agent run must be observable.
19. Every expensive AI operation must be usage tracked.
20. Do not add features outside the current phase.
21. Maintain TypeScript strictness.
22. Add tests for critical business logic.
23. Preserve existing working functionality.
24. Run lint, typecheck and tests after each phase.
25. Do not mark a phase complete until its acceptance criteria pass.
```

---

# 50. The Master Prompt for Your Coding Agent

You can paste this directly as the **initial implementation instruction**:

# LeadGennie V1 — Implementation Mission

You are working on the existing LeadGennie repository.

Your mission is to transform the current application into a production-ready MVP for an AI outbound operator.

## Product Definition

LeadGennie allows a user to describe who they want to sell to, discover and import prospects, research those prospects, qualify them, identify buying signals, generate evidence-backed personalized outreach, create email campaigns, send approved campaigns, monitor replies, classify replies, and generate suggested responses.

The product should feel like an AI outbound operator rather than a traditional CRM.

## Core Product Loop

Target definition
→ Prospect discovery/import
→ Enrichment
→ Company/lead research
→ ICP scoring
→ Buying signals
→ Evidence
→ Personalized outreach
→ Campaign
→ User approval
→ Email execution
→ Reply
→ Reply classification
→ AI response draft
→ Human approval
→ Conversation/meeting

## Critical Product Principle

Every AI-generated recommendation should be explainable.

For important lead decisions, show:

* Why this lead?
* Why now?
* Why this message?
* Supporting evidence/source

Never fabricate facts.

## Engineering Principle

Do NOT rewrite the existing application.

First inspect the repository and identify:

* existing routes
* existing components
* existing database schema
* existing authentication
* existing integrations
* existing API routes
* existing Chrome extension
* existing AI implementation
* existing campaign functionality

Reuse working code wherever possible.

## Implementation Phases

Implement strictly in this order:

### Phase 0

Codebase stabilization.

### Phase 1

Lead ingestion and lead foundation.

### Phase 2

Lead/company intelligence.

### Phase 3

AI personalization.

### Phase 4

Campaign builder.

### Phase 5

Reliable email execution engine.

### Phase 6

Inbox and reply intelligence.

### Phase 7

Chrome extension integration.

### Phase 8

Gennie agent/orchestrator.

### Phase 9

Analytics.

### Phase 10

Credits/usage.

### Phase 11

Billing and beta readiness.

Do not skip ahead unless the current phase is complete.

## Required Core Entities

The implementation should support, directly or through appropriate existing equivalents:

User
Workspace
WorkspaceMember
Lead
Company
LeadResearch
Signal
Evidence
Campaign
Sequence
SequenceStep
CampaignLead
Message
InboxThread
AgentRun
Activity
UsageRecord

Reuse existing models when they already provide equivalent functionality.

## Agent Architecture

Do not create one giant autonomous prompt.

Use an orchestrator and explicit tools.

Required conceptual tools include:

search_companies
search_people
get_company
get_person
enrich_lead
research_company
find_buying_signals
score_lead
generate_email
create_campaign
preview_campaign
schedule_campaign
pause_campaign
classify_reply
draft_reply
send_reply

AI should not directly mutate arbitrary database state.

AI produces structured output.

Application business logic validates the output.

Application code performs mutations.

## Agent UX

The Command Center should allow natural language requests such as:

"Find 50 SaaS companies in India with 50–500 employees that are hiring salespeople and prepare an outbound campaign."

Before expensive execution, show a plan:

1. Discover companies
2. Filter companies
3. Find decision makers
4. Research prospects
5. Detect buying signals
6. Score prospects
7. Generate personalized outreach
8. Prepare campaign

Show estimated records and estimated credit usage when possible.

Require explicit user approval before campaign sending in V1.

During execution show live progress.

Users should be able to inspect results, pause or cancel appropriate jobs.

## Lead Intelligence

A lead should expose:

* ICP score
* intent score
* company information
* role information
* research summary
* pain hypothesis
* buying signals
* recommended outreach angle
* evidence

Evidence should include source URL and source metadata whenever available.

## Campaign System

V1 supports email only.

Campaign flow:

Audience
→ Sequence
→ Personalization
→ Preview
→ Approval
→ Schedule
→ Send

Support:

* multiple sequence steps
* delays
* personalization
* scheduling
* pause/resume
* cancellation
* retries
* rate limits
* unsubscribe
* bounce handling
* idempotent sends

Do not build automated LinkedIn messaging in V1.

## Inbox

Support:

* email threads
* reply ingestion
* classification
* interested
* not interested
* question
* meeting request
* out of office
* unsubscribe
* bounce
* other

Generate AI response suggestions.

Do not automatically send AI-generated replies in V1.

Require user approval.

## Multi-tenancy

Every workspace-owned object must be workspace-scoped.

Every API mutation must verify:

1. authenticated user
2. workspace membership
3. ownership/access to target resource

Never expose another workspace's data.

## Background Jobs

Long-running tasks must not depend on a single HTTP request.

Use a durable job architecture appropriate to the existing project.

Jobs should support:

* retries
* idempotency
* failure states
* logging
* cancellation where appropriate

Required conceptual jobs:

lead_enrichment
company_research
lead_scoring
personalization
campaign_send
campaign_followup
email_sync
reply_classification
analytics_aggregation

## Observability

Every agent run should record:

* run ID
* workspace
* user
* task
* status
* start time
* completion time
* tools used
* token usage when available
* credit usage
* error information

## UX Direction

The application should feel:

* modern
* minimal
* premium
* calm
* agentic
* transparent

Avoid:

* excessive gradients
* excessive glassmorphism
* fake AI effects
* cluttered dashboards
* meaningless KPI cards
* fake production metrics

Use real workspace data in authenticated screens.

Demo data must be clearly identifiable as demo data.

## Navigation

Keep the primary navigation compact:

Command Center
Leads
Campaigns
Inbox
Analytics
Settings

Do not create unnecessary top-level sections.

## Quality Requirements

After every phase:

1. Run TypeScript typecheck.
2. Run lint.
3. Run tests.
4. Verify database migrations.
5. Test authentication.
6. Test workspace isolation.
7. Test primary user flow.
8. Check for regressions.

Do not claim a phase is complete if its acceptance criteria do not pass.

## Definition of V1 Complete

A new user must be able to:

1. Sign up.
2. Create a workspace.
3. Connect an email account/provider.
4. Import leads.
5. Run Gennie against those leads.
6. Research leads.
7. See ICP scores.
8. See buying signals.
9. See evidence.
10. Generate personalized emails.
11. Create a campaign.
12. Review the campaign.
13. Approve the campaign.
14. Schedule it.
15. Send messages.
16. Receive a reply.
17. Classify the reply.
18. Generate a suggested response.
19. Approve the response.
20. Send the response.

Do not expand the scope until this end-to-end workflow works reliably.

## First Task

Before changing code, inspect the entire existing repository.

Produce an internal implementation map identifying:

* what already exists
* what can be reused
* what is incomplete
* what should be refactored
* what must be added
* existing database schema
* existing API routes
* existing authentication
* existing campaign implementation
* existing Chrome extension functionality
* existing AI functionality

Then begin Phase 0.

Do not rewrite the application.
Do not build all phases at once.
Ship incrementally.
Prioritize the end-to-end outbound loop over secondary features.

---

## One strategic change I'd make to your original LeadGennie idea

Don't think of the roadmap as:

**"Build all the pages."**

Think:

> **Build one autonomous revenue workflow extremely well.**

The first moment I'd want to see working is:

**“I gave LeadGennie 50 prospects → Gennie researched them → showed me why 31 are good → wrote 31 evidence-backed emails → I approved → LeadGennie sent them → someone replied → Gennie understood the reply and drafted my response.”**

Once you can demo that in ~2 minutes, you have something worth putting in front of real founders and agencies.

And your existing codebase is far enough along that I would **start with Phase 0 rather than rebuilding the UI from scratch**.
