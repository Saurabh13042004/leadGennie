/**
 * Non-V1 modules (Deals, Tasks, Agentic Flows, CRM Sync, …) are hidden from
 * navigation unless this is "true". Hidden ≠ deleted: their routes and code
 * stay, and pages that are pure "coming soon" stubs return 404 while it's off.
 * NEXT_PUBLIC_ so the client-side sidebar sees the same value (inlined at build).
 */
export const SHOW_LEGACY_MODULES = process.env.NEXT_PUBLIC_SHOW_LEGACY_MODULES === "true";

/**
 * D-05 (decided 2026-09-25): LinkedIn DM automation is off by default in V1. With it off, the campaign builder is
 * email-only and the multi-channel wizard (which can add LinkedIn DM steps) is not offered. Server-side flag: read
 * at request time by the pages that offer it. Existing campaigns and the extension queue are untouched in Phase 4.
 */
export function linkedinAutomationEnabled(): boolean {
  return process.env.FEATURE_LINKEDIN_AUTOMATION === "true";
}
