import { afterEach } from "vitest";
import { encryptSecret } from "@/lib/crypto";
import { OAuthError, type AuthorizeParams, type OAuthProviderClient, type TokenSet } from "@/lib/domain/mailboxes/oauth/types";
import { setOAuthClient } from "@/lib/domain/mailboxes/oauth/registry";
import { clearMailboxProviderOverrides, setMailboxProviderOverride } from "@/lib/domain/mailboxes/registry";
import { GMAIL_SEND_SCOPE, GRAPH_SEND_SCOPE } from "@/lib/domain/mailboxes/scopes";
import type { MailboxProviderKey, MailboxStatus, OAuthMailboxProvider } from "@/lib/domain/mailboxes/types";
import { FakeMailProvider } from "@/lib/email/fake-provider";
import { sql } from "./test-db";

/** A scripted stand-in for Google's / Microsoft's OAuth endpoints. Records what it was asked; never touches the network. */
export class ScriptedOAuthClient implements OAuthProviderClient {
  configured = true;
  exchangeResult: TokenSet | OAuthError = {
    accessToken: "access-1", refreshToken: "refresh-1", expiresAt: new Date(Date.now() + 3_600_000), scopes: ["openid", "email", "profile", GMAIL_SEND_SCOPE],
  };
  /** Consumed one per `refresh` call; when empty, refresh succeeds with a fresh access token. */
  refreshScript: (TokenSet | OAuthError)[] = [];
  refreshCalls: string[] = [];
  exchangeCalls: { code: string; codeVerifier: string; redirectUri: string }[] = [];
  revoked: string[] = [];
  revokeError: OAuthError | null = null;
  authorizeCalls: AuthorizeParams[] = [];
  private n = 0;

  constructor(readonly provider: OAuthMailboxProvider, withRevoke = true) {
    if (!withRevoke) this.revoke = undefined;
  }

  isConfigured() {
    return this.configured;
  }
  buildAuthorizeUrl(p: AuthorizeParams) {
    this.authorizeCalls.push(p);
    return `https://idp.test/authorize?state=${p.state}&scope=${encodeURIComponent(p.scopes.join(" "))}`;
  }
  async exchangeCode(p: { code: string; redirectUri: string; codeVerifier: string }) {
    this.exchangeCalls.push(p);
    if (this.exchangeResult instanceof OAuthError) throw this.exchangeResult;
    return this.exchangeResult;
  }
  async refresh(refreshToken: string) {
    this.refreshCalls.push(refreshToken);
    const next = this.refreshScript.shift() ?? { accessToken: `access-refreshed-${++this.n}`, refreshToken: null, expiresAt: new Date(Date.now() + 3_600_000), scopes: [] };
    if (next instanceof OAuthError) throw next;
    return next;
  }
  revoke?: (token: string) => Promise<void> = async (token) => {
    if (this.revokeError) throw this.revokeError;
    this.revoked.push(token);
  };
}

/** Installs scripted OAuth clients + fake mailbox providers for both OAuth providers; restores the real ones after each test. */
export function installMailboxFakes() {
  const oauth = { gmail: new ScriptedOAuthClient("gmail"), microsoft: new ScriptedOAuthClient("microsoft") };
  const providers = { gmail: new FakeMailProvider({ name: "gmail", idempotent: false }), microsoft: new FakeMailProvider({ name: "microsoft", idempotent: false, threading: false }) };
  const install = () => {
    oauth.gmail = new ScriptedOAuthClient("gmail");
    oauth.microsoft = new ScriptedOAuthClient("microsoft");
    oauth.microsoft.exchangeResult = { accessToken: "ms-access", refreshToken: "ms-refresh", expiresAt: new Date(Date.now() + 3_600_000), scopes: ["openid", "User.Read", GRAPH_SEND_SCOPE] };
    providers.gmail = new FakeMailProvider({ name: "gmail", idempotent: false });
    providers.gmail.profile = { providerAccountId: "g-123", email: "me@acme.com", displayName: "Ada", emailVerified: true };
    providers.microsoft = new FakeMailProvider({ name: "microsoft", idempotent: false, threading: false });
    providers.microsoft.profile = { providerAccountId: "ms-123", email: "ada@contoso.com", displayName: "Ada", emailVerified: true };
    setOAuthClient("gmail", oauth.gmail);
    setOAuthClient("microsoft", oauth.microsoft);
    setMailboxProviderOverride("gmail", providers.gmail);
    setMailboxProviderOverride("microsoft", providers.microsoft);
  };
  install();
  afterEach(() => {
    setOAuthClient("gmail", null);
    setOAuthClient("microsoft", null);
    clearMailboxProviderOverrides();
    install(); // fresh fakes for the next test (the afterEach above cleared the seams; re-arm them)
  });
  return { oauth, providers };
}

/** Inserts an OAuth mailbox with real (encrypted) tokens, as the connect flow would have. */
export async function createOAuthMailbox(workspaceId: number, o: {
  provider?: Exclude<MailboxProviderKey, "resend">; email?: string; status?: MailboxStatus; accessToken?: string | null; refreshToken?: string | null;
  expiresInMs?: number; scopes?: string[]; dailyLimit?: number; ageDays?: number; providerAccountId?: string; ownerUserId?: number | null;
} = {}) {
  const provider = o.provider ?? "gmail";
  const email = o.email ?? `me${workspaceId}@acme.com`;
  const access = o.accessToken === undefined ? "access-stored" : o.accessToken;
  const refresh = o.refreshToken === undefined ? "refresh-stored" : o.refreshToken;
  const [row] = await sql`
    insert into mailboxes (workspace_id, provider, email, display_name, provider_account_id, status, daily_limit, owner_user_id, access_token_enc, refresh_token_enc,
                           token_expires_at, scopes, connected_at, created_at)
    values (${workspaceId}, ${provider}, ${email}, 'Ada', ${o.providerAccountId ?? `acct-${email}`}, ${o.status ?? "active"}, ${o.dailyLimit ?? 50}, ${o.ownerUserId ?? null},
            ${access ? encryptSecret(access) : null}, ${refresh ? encryptSecret(refresh) : null}, ${new Date(Date.now() + (o.expiresInMs ?? 3_600_000)).toISOString()}::timestamptz,
            ${o.scopes ?? [provider === "gmail" ? GMAIL_SEND_SCOPE : GRAPH_SEND_SCOPE]}::text[], now(), now() - ${`${o.ageDays ?? 60} days`}::interval)
    returning id`;
  return { id: Number(row.id), email };
}
