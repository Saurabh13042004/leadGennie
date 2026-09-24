/**
 * Non-V1 modules (Deals, Tasks, Agentic Flows, CRM Sync, …) are hidden from
 * navigation unless this is "true". Hidden ≠ deleted: their routes and code
 * stay, and pages that are pure "coming soon" stubs return 404 while it's off.
 * NEXT_PUBLIC_ so the client-side sidebar sees the same value (inlined at build).
 */
export const SHOW_LEGACY_MODULES = process.env.NEXT_PUBLIC_SHOW_LEGACY_MODULES === "true";
