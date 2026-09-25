import { ROLE_RANK, type Role } from "@/lib/workspace";

/**
 * What a connected extension may do. Scopes are granted at connect time from the
 * user's role, and the ROLE is checked again on every request (a scope is a ceiling,
 * never a substitute for the user's current permissions).
 *
 *   leads:read        look leads up, list recent leads, read research status
 *   leads:create      capture a lead
 *   research:trigger  start "Research with Gennie"
 *   automation        LinkedIn queue / message drafting — only while FEATURE_LINKEDIN_AUTOMATION is on (D-05)
 */
export const EXTENSION_SCOPES = ["leads:read", "leads:create", "research:trigger", "automation"] as const;
export type ExtensionScope = (typeof EXTENSION_SCOPES)[number];

/** Minimum workspace role required to exercise each scope. */
const MIN_ROLE: Record<ExtensionScope, Role> = {
  "leads:read": "viewer",
  "leads:create": "member",
  "research:trigger": "member",
  automation: "member",
};

export function roleAllowsScope(role: Role, scope: ExtensionScope): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[MIN_ROLE[scope]];
}

/** The scopes a user with this role can be granted. `automation` is only ever offered while the D-05 flag is on. */
export function scopesForRole(role: Role, opts: { automation: boolean }): ExtensionScope[] {
  return EXTENSION_SCOPES.filter((s) => roleAllowsScope(role, s) && (s !== "automation" || opts.automation));
}

export function isExtensionScope(value: string): value is ExtensionScope {
  return (EXTENSION_SCOPES as readonly string[]).includes(value);
}

/** Plain-language description for the consent screen and the sessions list. */
export const SCOPE_LABEL: Record<ExtensionScope, string> = {
  "leads:read": "See your leads and their status",
  "leads:create": "Add leads you capture from web pages",
  "research:trigger": "Start research on a lead",
  automation: "LinkedIn message automation (advanced)",
};
