# Phase changelog

Evidence log for each phase. Newest first.

## Phase 0 — Stabilization (in progress, started 2026-09-24)

### Baseline recorded 2026-09-24 (before any Phase 0 change)

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ clean |
| `next build` | ✅ passes (Next 16.2.6 / Turbopack) |
| `eslint` | ❌ **57 problems: 38 errors, 19 warnings.** 29 errors are `no-explicit-any` in the vendored `components/LiquidEther.tsx` (third-party WebGL effect); the rest are in landing components (`AiTerminal`, `BookDemoModal`, `DashboardPreview`, `security/page`) |
| Tests | none existed |
| Live DB vs `lib/db/schema.sql` | **Drift found**: production had `workspace_id NOT NULL` on 5 tables, `api_tokens_workspace_id_idx` unique, `api_tokens.owner_email` unique dropped, `crm_connections_workspace_provider_portal_idx` — all applied by hand via the one-off `scripts/migrate-workspaces.mjs`, never recorded in `schema.sql`. Captured in `0002_workspace_enforcement.sql`. |

### Work log

_Filled in as work packages land — see bottom of this file._
