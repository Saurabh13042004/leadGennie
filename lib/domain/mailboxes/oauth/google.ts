import type { FetchLike } from "@/lib/email/http";
import { postTokenForm, toTokenSet } from "./common";
import { OAuthError, type AuthorizeParams, type OAuthProviderClient, type TokenSet } from "./types";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const REVOKE = "https://oauth2.googleapis.com/revoke";

export class GoogleOAuthClient implements OAuthProviderClient {
  readonly provider = "gmail" as const;

  constructor(
    private readonly env: Record<string, string | undefined> = process.env,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  isConfigured() {
    return Boolean(this.env.GOOGLE_CLIENT_ID && this.env.GOOGLE_CLIENT_SECRET);
  }

  private creds() {
    const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = this.env;
    if (!id || !secret) throw new OAuthError("Google sign-in isn't configured on this server", "not_configured");
    return { client_id: id, client_secret: secret };
  }

  buildAuthorizeUrl(p: AuthorizeParams): string {
    const q = new URLSearchParams({
      client_id: this.creds().client_id, redirect_uri: p.redirectUri, response_type: "code", scope: p.scopes.join(" "), state: p.state,
      code_challenge: p.codeChallenge, code_challenge_method: "S256",
      // offline + consent: without both Google only issues a refresh token the very first time an account ever connects.
      access_type: "offline", prompt: "select_account consent",
    });
    if (p.loginHint) q.set("login_hint", p.loginHint);
    return `${AUTHORIZE}?${q}`;
  }

  async exchangeCode(p: { code: string; redirectUri: string; codeVerifier: string }): Promise<TokenSet> {
    const body = await postTokenForm(this.fetchImpl, TOKEN, { ...this.creds(), grant_type: "authorization_code", code: p.code, redirect_uri: p.redirectUri, code_verifier: p.codeVerifier });
    return toTokenSet(body, this.now());
  }

  async refresh(refreshToken: string): Promise<TokenSet> {
    const body = await postTokenForm(this.fetchImpl, TOKEN, { ...this.creds(), grant_type: "refresh_token", refresh_token: refreshToken });
    return toTokenSet(body, this.now());
  }

  async revoke(token: string): Promise<void> {
    try {
      const res = await this.fetchImpl(REVOKE, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }).toString() });
      // 400 invalid_token = already revoked or expired: that is the outcome we wanted.
      if (!res.ok && res.status !== 400) throw new OAuthError(`Google revoke failed (HTTP ${res.status})`, "transient");
    } catch (e) {
      if (e instanceof OAuthError) throw e;
      throw new OAuthError("Couldn't reach Google to revoke access", "transient");
    }
  }
}
