# Mission: Phase 11 — Billing & Beta Readiness

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-11-billing-beta.md`.

## Objective
Ready to invite real users: truthful landing page, guided onboarding, minimal billing (or explicit manual-grant mode), compliance/export/delete, monitoring, and the V1 release gate passed twice.

## Preconditions
- [ ] Phases 0–10 Done and tagged
- [ ] Stripe account + test keys (if billing is on for beta) — else agree "manual grant + invite code" interim
- [ ] Legal reviewer identified for terms/privacy/AUP (you draft; a human lawyer reviews — **you are not giving legal advice**)
- [ ] Error-tracking account (e.g. Sentry) available

## Read first
`app/page.tsx` + landing components, `app/{terms,privacy,security}/page.tsx`, `app/compare/*`, `docs/06-quality-and-testing.md` (V1 E2E gate), credits/ledger code, auth flows (check for password reset and rate limiting).

## Work packages
1. **WP11.1 Landing** — hero/copy per spec; "Watch Gennie work" driven by `demo/` fixtures with a **non-removable "Demo data" label**; pricing from config; audit `/compare/*` claims (remove unverifiable competitor claims); Lighthouse ≥ 90 perf/a11y on `/`; grep gate confirms no non-demo metrics.
2. **WP11.2 Onboarding** — guided steps (workspace → positioning → ICP → connect email with SPF/DKIM/DMARC checklist → import/extension → Run Gennie), persisted progress, real-state empty states, opt-in labelled demo workspace, activation events.
3. **WP11.4 Compliance & trust** — legal pages updated (subprocessors, retention, cold-email obligations), AUP + attestation at workspace creation, workspace suspension control, export + deletion (retain suppression hashes), security pass (auth rate limits, password reset, headers/CSP, dependency audit).
4. **WP11.3 Billing (minimal)** — Stripe Checkout + Portal, `subscriptions`, idempotent verified webhooks → monthly credit grants; grace/downgrade never deletes data. Feature-flag it if beta is manual.
5. **WP11.5 Operations** — (both services; engine production checklist in `docs/intelligence-engine/development.md`, secret-rotation drill, engine alerts and runbook section) error tracking, alerts (queue lag, dead jobs, bounce spikes), backups + one tested restore, `docs/runbook.md`.
6. **WP11.6 Beta program** — invite-code gate, feedback widget, changelog/known-issues pages, Chrome Web Store (unlisted) submission checklist.
7. **WP11.7 Release gate** — run the V1 E2E gate twice consecutively on staging with a real mailbox + the 2-minute demo; verify every prior phase's acceptance list; tag `v1.0.0-beta`.

## Do NOT
Invest in enterprise features, annual invoicing, referral programs, SOC2 work (gap list only) · put unverifiable claims, testimonials, logos, or live counters on the landing page · store card data yourself · skip the legal-review step for the pages you draft.

## Verification
Stripe test-mode flows (upgrade, cancel, failed payment) · webhook idempotency/signature tests · export completeness + isolation · deletion cascade + suppression retained · onboarding walk-through as a brand-new user, unaided · Lighthouse report · alert fire drill · E2E gate ×2 · `npm run verify`.

## STOP and ask if
Legal/compliance questions arise that only counsel can answer · the E2E gate fails intermittently (fix root cause; don't retry until green) · Chrome Web Store policy conflicts with the extension's permissions.

## Report
Format in `docs/missions/README.md`, with the two E2E gate transcripts attached.
