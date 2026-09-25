import type { OAuthMailboxProvider } from "../types";

export type TokenSet = {
  accessToken: string;
  /** Google only returns one on the first consent; Microsoft rotates it on every refresh. Null = "keep the one you have". */
  refreshToken: string | null;
  expiresAt: Date;
  /** What the user actually granted (they can untick boxes on the consent screen). Empty = the provider didn't say. */
  scopes: string[];
};

/**
 * `invalid_grant`  the refresh token / code is dead (revoked, expired, password changed, MFA needed) — the user must reconnect.
 * `access_denied`  the user pressed Cancel on the consent screen.
 * `transient`      the provider or the network hiccuped — try again later, the grant may be fine.
 * `rejected`       anything else the provider refused (misconfigured client id/secret, bad redirect URI).
 */
export type OAuthErrorKind = "invalid_grant" | "access_denied" | "transient" | "rejected" | "not_configured";

export class OAuthError extends Error {
  constructor(message: string, readonly kind: OAuthErrorKind) {
    super(message);
    this.name = "OAuthError";
  }
}

export type AuthorizeParams = { redirectUri: string; state: string; codeChallenge: string; scopes: string[]; loginHint?: string };

/** One OAuth provider's endpoints and quirks. Adapters stop here — callers see `TokenSet`, never a provider's token JSON. */
export interface OAuthProviderClient {
  readonly provider: OAuthMailboxProvider;
  /** Client id and secret are set on this server. */
  isConfigured(): boolean;
  buildAuthorizeUrl(p: AuthorizeParams): string;
  exchangeCode(p: { code: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  /** Revokes a token at the provider. Absent when the provider has no such endpoint (Microsoft). Must not throw for an already-revoked token. */
  revoke?(token: string): Promise<void>;
}
