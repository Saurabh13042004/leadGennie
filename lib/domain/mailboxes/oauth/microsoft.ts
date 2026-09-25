import type { FetchLike } from "@/lib/email/http";
import { postTokenForm, toTokenSet } from "./common";
import { OAuthError, type AuthorizeParams, type OAuthProviderClient, type TokenSet } from "./types";

export class MicrosoftOAuthClient implements OAuthProviderClient {
  readonly provider = "microsoft" as const;

  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  isConfigured() {
    return Boolean(this.env.MICROSOFT_CLIENT_ID && this.env.MICROSOFT_CLIENT_SECRET);
  }

  /** `common` = work/school AND personal accounts. Set MICROSOFT_TENANT to a tenant id to restrict sign-in to one organisation. */
  private base() {
    const tenant = this.env.MICROSOFT_TENANT?.trim() || "common";
    if (!/^[A-Za-z0-9.-]+$/.test(tenant)) throw new OAuthError("MICROSOFT_TENANT isn't a valid tenant id", "not_configured");
    return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
  }

  private creds() {
    const { MICROSOFT_CLIENT_ID: id, MICROSOFT_CLIENT_SECRET: secret } = this.env;
    if (!id || !secret) throw new OAuthError("Microsoft sign-in isn't configured on this server", "not_configured");
    return { client_id: id, client_secret: secret };
  }

  buildAuthorizeUrl(p: AuthorizeParams): string {
    const q = new URLSearchParams({
      client_id: this.creds().client_id, redirect_uri: p.redirectUri, response_type: "code", response_mode: "query", scope: p.scopes.join(" "), state: p.state,
      code_challenge: p.codeChallenge, code_challenge_method: "S256", prompt: "select_account",
    });
    if (p.loginHint) q.set("login_hint", p.loginHint);
    return `${this.base()}/authorize?${q}`;
  }

  async exchangeCode(p: { code: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet> {
    const body = await postTokenForm(this.fetchImpl, `${this.base()}/token`, { ...this.creds(), grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, code_verifier: p.codeVerifier });
    return toTokenSet(body, this.now());
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = await postTokenForm(this.fetchImpl, `${this.base()}/token`, { ...this.creds(), grant_type: "refresh_token", refresh_token: refreshToken });
    return toTokenSet(body, this.now());
  }

  // No `revoke`: the Microsoft identity platform has no endpoint that revokes one app's refresh token. Disconnecting deletes our
  // copy; the user can also remove the app at https://myapps.microsoft.com (documented in docs/mailboxes.md).
}
