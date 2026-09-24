# Phase 11 — Billing & Beta Readiness

## Goal
Everything needed to put LeadGennie in front of real founders and agencies: a truthful landing page, smooth onboarding, minimal billing, compliance hygiene, monitoring, and the V1 release gate. **Spend the minimum on billing** — PLAN: don't invest heavily before beta users prove value.

## Starting point
Credits + limits exist (Phase 10). Landing page had fake metrics removed in Phase 0 and is currently neutral. No billing, no legal review of outbound-email obligations, no error tracking, no data export/delete, no beta-invite mechanism.

## Scope

### WP11.1 — Landing page rebuild (per PLAN §45–46)
- Hero: **"Your AI outbound operator."** — *Find the right prospects, understand why they're a fit, and turn them into conversations.* CTAs **Start free** / **Watch Gennie work**.
- "Watch Gennie work": an interactive/animated product demonstration using a **fixture-driven demo** clearly labelled **"Demo data"** (e.g. "Find 50 SaaS companies in India that are hiring salespeople" → 312 discovered / 87 ICP matches / 63 decision-makers / 41 signals / 50 messages) — component reads from `demo/` fixtures, never from production tables, and the label is part of the component (cannot be removed by copy edits).
- Sections: how it works (loop), evidence-backed explanation ("Why this lead / why now / why this message" screenshot), safety/approval promise, pricing (from WP11.3), FAQ (deliverability, data, compliance), footer legal.
- **No** fabricated metrics, testimonials, logos of non-customers, or "live" counters. Real customer logos/quotes only with written permission.
- Performance & SEO: Lighthouse ≥ 90 perf/a11y on `/`; retire three.js/heavy effects if they hurt LCP; comparison pages (`/compare/*`) audited for factual claims about competitors (remove unverifiable claims).

### WP11.2 — Onboarding & activation
Guided first-run: sign up → workspace name → **what you sell** (positioning) → ICP → **connect email** (D-04 flow, with deliverability checklist: domain, SPF/DKIM/DMARC status) → import leads (CSV / extension install) → *Run Gennie* on the imported leads. Progress persisted; skip allowed; empty states link to the next step. Sample "demo workspace" data is opt-in and visibly flagged `Demo`.
Activation events tracked (privacy-respecting, workspace-level): imported leads, first research, first campaign approved, first reply. Used to evaluate beta.

### WP11.3 — Billing (minimal)
- Stripe Checkout + Customer Portal; plans **Free** (limited leads/credits), **Pro** (monthly credits), **Team** (shared workspace, more credits) — names/limits from Phase 10 config; pricing decided by D-09 data. Webhooks (idempotent, signature-verified) → `subscriptions` table → monthly `grant` in the credit ledger; upgrade/downgrade/cancel; failed payment → grace period then downgrade to Free (never deletes data).
- Top-up credit packs optional (defer if time-boxed).
- Billing page in Settings; invoices via Stripe portal.
- **Skip for closed beta if needed**: manual grants + invite code is an acceptable interim; billing is *ready*, not necessarily *on*.

### WP11.4 — Compliance & trust
- Legal pages reviewed/updated (`/terms`, `/privacy`, `/security` exist): data processed, subprocessors (Neon, Resend, Google, Stripe), retention, cold-email obligations (CAN-SPAM identity/address/unsubscribe, CASL/GDPR notes — **get legal review; this doc is not legal advice**).
- **Acceptable-use policy** + in-product agreement at workspace creation: user attests lawful basis for contacting leads; abuse reporting path; suspension controls (admin can disable a workspace's sending).
- **Data export & deletion**: per-workspace export (JSON/CSV of leads, messages, campaigns) and deletion request flow; deleting a workspace removes data but retains the suppression list hashes needed to honor prior unsubscribes.
- Security review pass: secrets handling, webhook verification, rate limits on auth/register, password reset flow (missing today? verify), session lifetime, dependency audit, CSP/security headers.

### WP11.5 — Operations
**Two services:** Next.js app + Python Intelligence Engine. Engine production checklist (`intelligence-engine/development.md`): ≥2 replicas, private networking, secret rotation drill, `intel` schema backups/retention, alerts on engine error rate / p95 run duration / LLM & search quota errors / fetch-block rate / budget-exhaustion rate, status shown in-app when the engine or a provider is degraded, runbook section for the engine (restart, key rotation, cache purge, stuck-run handling). Compliance note for the fetch layer: honest User-Agent + bot info page, robots respected, takedown/opt-out contact for companies who don't want to be researched.
Error tracking (Sentry or equivalent), uptime + queue-lag alerts (jobs `queued` age > N min, dead-job count, bounce-rate spikes), structured-log retention, DB backups + tested restore, migration runbook, on-call/incident notes in `docs/runbook.md`. Status of provider dependencies (OpenAI, Resend, Google) surfaced in-app when degraded.

### WP11.6 — Beta program
Invite-code signup gate (`beta_invites`), feedback widget (in-app, stores to DB), support email, changelog page, known-issues page, cohort of 5–10 design partners, weekly metrics review template. Chrome Web Store submission (unlisted) for the extension.

### WP11.7 — Release gate
Run the **V1 E2E gate** (`06-quality`) twice consecutively on staging with a real mailbox, then a manual demo of the 2-minute story. Checklist review of all phase acceptance criteria; tag `v1.0.0-beta`.

## Out of scope
Enterprise SSO/RBAC, annual invoicing, marketplace, referral program, mobile app, localization, SOC2 (start a gap list only).

## Data changes
`0021_subscriptions`, `beta_invites`, `feedback`, `workspace_exports`, workspace `status` (active/suspended).

## Tests
Stripe webhook idempotency & signature · plan change → correct credit grant · failed payment grace/downgrade · export contains all workspace data & nothing from others · deletion cascades + retains suppression · invite gate · legal-page presence · landing has no non-demo metrics (grep gate) · Lighthouse budget in CI (non-blocking) · full E2E gate.

## Acceptance criteria
- [ ] Landing page communicates the product with **zero fabricated metrics**; demo content is labelled "Demo data"
- [ ] A new user can go from sign-up to a first approved campaign following the onboarding, unaided
- [ ] Billing (or explicit manual-grant mode) works: upgrade, cancel, failed payment handled; credits granted correctly
- [ ] Legal/compliance pages present and reviewed; workspace export + delete work; suppression survives deletion
- [ ] Error tracking + alerts live; runbook exists; backup restore tested once
- [ ] Beta invite + feedback loop operational
- [ ] **V1 E2E gate passes twice consecutively**; all prior-phase acceptance criteria still pass
- [ ] `npm run verify` green; `v1.0.0-beta` tagged

## Risks
Legal exposure from cold email → clear AUP, compliance defaults on, legal review before opening signup. Billing complexity creeping in → keep it to Checkout + Portal. Beta feedback overload → weekly triage against the core loop only (rule 20).

## Exit
Beta launch. Mission: [`missions/phase-11-billing-beta.md`](../missions/phase-11-billing-beta.md).
