# Mission: Phase 7 — Chrome Extension (Capture)

> Read `docs/missions/_preamble.md` first. Spec: `docs/phases/phase-07-chrome-extension.md`.

## Objective
The extension is a capture tool: one click adds a prospect (with company + domain) to LeadGennie, optionally triggers research. It cannot send LinkedIn messages in V1.

## Preconditions
- [ ] Phase 2B Done (research endpoint `POST /api/leads/:id/research` exists, backed by the engine); may run in parallel with Phases 5–6
- [ ] **D-05 resolved** (LinkedIn automation off by default)
- [ ] Phase 0 token hashing in place

## Read first
`chrome-extension/{manifest.json,content.js,background.js,popup.*,options.*,services/*}`, `app/api/extension/*`, `lib/auth/extension-token.ts`, `lib/ai/linkedin-personalize.ts`, `lib/ai/linkedin-element-picker.ts`, Phase 1 `matchOrCreateCompany`.

## Work packages
1. **WP7.3 Hardening first** — confirm no keys/direct-LLM calls in the extension bundle (grep); scoped, hashed, rotatable tokens; per-token rate limit; least-privilege manifest permissions.
2. **WP7.4 Flag gating** — `FEATURE_LINKEDIN_AUTOMATION`; with it off: queue returns `[]`, DM buttons hidden, send path dead-ended with a log line; `DRY_RUN` default `true`. **Do not delete the code.**
3. **WP7.1 Capture flow** — editable capture card → Add Lead → confirmation; zod-validated server extraction, provenance (`source='extension'`, `source_url`); company/domain resolution; duplicate detection with deep link; generic extractor for company/team pages.
4. **WP7.2 Research with Gennie** — button → Phase 2 endpoint with status + deep link.
5. **WP7.5 Polish** — connection status, error states, options page "Test connection", activity log limited to capture events.

## Do NOT
Automate LinkedIn messages/connection requests · bulk-scrape search results/lists · move extraction back into the client · publish to the Chrome Web Store (Phase 11) · delete the LinkedIn send code.

## Verification
API tests (auth/scope/rate-limit/zod/duplicates/company match/flag-off/isolation) · manual checklist: load unpacked, capture from a real LinkedIn profile and a company site, duplicate add, revoked token → 401, flag off → no DM possible · `npm run verify`.

## STOP and ask if
Capture from LinkedIn requires behavior that violates their ToS beyond simple user-initiated page reading · removing permissions breaks a working flow the user relies on.

## Report
Format in `docs/missions/README.md`.
