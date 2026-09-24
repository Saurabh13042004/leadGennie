# Phase 7 — Chrome Extension (Lead Capture)

## Goal
The extension is a **lead-capture mechanism**: on a prospect's page, one click adds them to LeadGennie (with company + domain), and optionally triggers "Research with Gennie". It does not send LinkedIn messages in V1.

## Starting point (already built — reuse)
Manifest V3 extension: `content.js` injects Add-to-Lead-List / Generate-Message buttons on LinkedIn profiles, an activity log, raw-page-text scraping with **server-side Gemini extraction** (`/api/extension/personalize`, `pick-element`), workspace API-token auth (`lib/auth/extension-token.ts`), `/api/extension/leads`, `/api/extension/queue` (LinkedIn DM queue; real sends with `DRY_RUN=false`), Google Sheets export service, direct Gemini call code (`services/gemini.js` — **hardcoded key removed earlier; verify none remain**).

## Decision dependency
**D-05**: LinkedIn auto-send off by default in V1. This phase implements the *capture-only* posture and gates the send path behind `FEATURE_LINKEDIN_AUTOMATION`.

## Scope

### WP7.1 — Capture flow
- Popup/inline card: `Sarah Chen · VP Sales · Acme · acme.com` with editable fields → **[Add Lead]** → `✓ Added to LeadGennie`.
- Extraction: keep raw-text + server-side extraction, but validate output with zod server-side and **never trust extracted values as verified evidence** (`source='extension'`, `source_url` = page URL, provenance recorded).
- Company domain resolution: from page (website link) or server-side lookup; company matched/created via `matchOrCreateCompany` (Phase 1). Duplicate detection returns "Already in LeadGennie" with a link.
- Works on: LinkedIn profile pages (existing), company websites/"team" pages (best-effort generic extractor), plain email/name selections. No mass-scraping (single page, user-initiated only).

### WP7.2 — Research with Gennie
Optional button → `POST /api/leads/:id/research` (Phase 2) via extension token; shows queued/done state and deep-links to the lead detail page. Extension never sees evidence content beyond status; heavy lifting stays server-side.

### WP7.3 — Auth & security hardening
- Extension token: workspace-scoped, **stored hashed server-side** (Phase 0), revocable/rotatable from Settings → API Credentials; scope limited to `leads:create`, `leads:read-status`, `research:trigger`.
- Remove direct-to-Gemini calls from the extension; all LLM work server-side (usage tracked, no keys in client).
- Least-privilege `manifest.json` (host permissions limited to `linkedin.com` + LeadGennie origin + `activeTab`), remove unused permissions/`gsheets` if unused in V1.
- Rate-limit `/api/extension/*` per token.

### WP7.4 — LinkedIn automation gating (D-05)
With flag off: queue route returns `[]`, message-generation buttons hidden, DM-sending code path dead-ended with a clear log line; **code retained**. With flag on (internal only): existing behavior, explicitly labelled "risk of LinkedIn account restrictions". `DRY_RUN` default flips back to `true`.

### WP7.5 — Extension UX polish
Connection status indicator, clear error states (unauthenticated, quota, offline), activity log kept (existing) but shows only capture events. Options page: API URL + token entry with "Test connection".

## Out of scope
LinkedIn messaging automation, connection-request automation, sequencing via LinkedIn, scraping lists/search results in bulk, Firefox/Safari, Chrome Web Store publication (Phase 11 checklist item).

## Data changes
`api_tokens` scopes/hash (if not done in Phase 0); `leads.source='extension'` + `source_url`.

## Tests
Extension API: token auth/scope/rate-limit · zod validation of extracted payload · duplicate detection · company matching · flag-off queue returns nothing · isolation. Manual checklist (documented) for the extension UI on a real LinkedIn profile + a company site.

## Acceptance criteria
- [ ] From a prospect page: **Add Lead** works in ≤2 clicks and the lead appears with company + domain
- [ ] Duplicate adds are detected, not created
- [ ] **Research with Gennie** triggers Phase 2 research and links to the detail page
- [ ] No secrets or LLM keys in the extension bundle; all AI is server-side
- [ ] With `FEATURE_LINKEDIN_AUTOMATION` off, the extension cannot send any LinkedIn message
- [ ] Token can be rotated/revoked; revoked token gets 401
- [ ] Manifest permissions minimal
- [ ] `npm run verify` green

## Risks
LinkedIn DOM/ToS changes break scraping → raw-text approach already resilient; capture is user-initiated, single-page. Extraction misparses → editable card before saving.

## Exit
Tag `phase-7-complete`. Mission: [`missions/phase-07-chrome-extension.md`](../missions/phase-07-chrome-extension.md).
