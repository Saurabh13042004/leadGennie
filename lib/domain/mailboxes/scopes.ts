import type { OAuthMailboxProvider } from "./types";

/**
 * OAuth scopes by purpose. A connection asks for `identity` + `send` today — the least that lets LeadGennie prove who owns the
 * mailbox and send from it. `inbox` (read mail, for reply detection) is defined here so the Inbox phase can request it
 * incrementally, but nothing requests it yet: an app that asks for more than it uses fails Google's review and scares users.
 *
 * Consent screens with granular permissions let the user untick a box, so what was GRANTED (returned by the token endpoint) is
 * checked against `required` — never assumed from what was asked.
 */
export type ScopeGroup = "identity" | "send" | "inbox";

export const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";
/** A Google *restricted* scope (security assessment required) — the reason Inbox sync is opt-in, not bundled with sending. */
export const GMAIL_READ_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const GRAPH_SEND_SCOPE = "Mail.Send";
export const GRAPH_READ_SCOPE = "Mail.Read";

const SCOPES: Record<OAuthMailboxProvider, Record<ScopeGroup, readonly string[]>> = {
  gmail: {
    identity: ["openid", "email", "profile"],
    send: [GMAIL_SEND_SCOPE],
    inbox: [GMAIL_READ_SCOPE],
  },
  microsoft: {
    // offline_access is what makes Microsoft issue a refresh token at all.
    identity: ["openid", "email", "profile", "offline_access", "User.Read"],
    send: [GRAPH_SEND_SCOPE],
    inbox: [GRAPH_READ_SCOPE],
  },
};

/** The scopes to request for these groups (identity is always included). */
export function scopesFor(provider: OAuthMailboxProvider, groups: readonly ScopeGroup[] = ["send"]): string[] {
  const all = new Set<string>(SCOPES[provider].identity);
  for (const g of groups) for (const s of SCOPES[provider][g]) all.add(s);
  return [...all];
}

/** What a connection cannot work without. Missing any of these after consent ⇒ the connection is refused. */
export function requiredScopes(provider: OAuthMailboxProvider): string[] {
  return [...SCOPES[provider].send];
}

/** Microsoft returns scopes bare ("Mail.Send") or resource-qualified ("https://graph.microsoft.com/Mail.Send"); compare bare. */
const bare = (scope: string) => scope.replace(/^https:\/\/graph\.microsoft\.com\//i, "").toLowerCase();

export function hasScope(granted: readonly string[], scope: string): boolean {
  const want = bare(scope);
  return granted.some((g) => bare(g) === want);
}

export const missingScopes = (provider: OAuthMailboxProvider, granted: readonly string[]) =>
  requiredScopes(provider).filter((s) => !hasScope(granted, s));

/** Does this connection let us read the mailbox? */
export const canReadMailbox = (provider: OAuthMailboxProvider, granted: readonly string[]) =>
  SCOPES[provider].inbox.every((s) => hasScope(granted, s));
