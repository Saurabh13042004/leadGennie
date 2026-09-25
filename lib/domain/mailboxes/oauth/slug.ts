import type { OAuthMailboxProvider } from "../types";

/** URL segment ↔ provider key. The route says `google` (what users call it); the mailbox row says `gmail` (which API sends). Plain module: client components import it. */
export const OAUTH_SLUGS = { google: "gmail", microsoft: "microsoft" } as const satisfies Record<string, OAuthMailboxProvider>;
export type OAuthSlug = keyof typeof OAUTH_SLUGS;

export const isOAuthSlug = (s: string): s is OAuthSlug => Object.hasOwn(OAUTH_SLUGS, s);
export const slugFor = (provider: OAuthMailboxProvider): OAuthSlug => (provider === "gmail" ? "google" : "microsoft");
