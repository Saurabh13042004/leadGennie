import { logActivity } from "@/lib/activity";
import { encryptSecret } from "@/lib/crypto";
import { createLogger } from "@/lib/log";
import type { AccessTokenSource } from "@/lib/email/mailbox-provider";
import { MailProviderError } from "@/lib/email/provider";
import "./register";
import { FlowError, FLOW_COOKIE, FLOW_TTL_SECONDS, newNonce, openFlowState, sealFlowState } from "./oauth/flow-state";
import type { ConnectErrorCode } from "./oauth/messages";
import { pkcePair } from "./oauth/common";
import { getOAuthClient, redirectUriFor } from "./oauth/registry";
import { OAuthError, type OAuthProviderClient } from "./oauth/types";
import { findByAccount, findByEmail, insertConnection, loadSecrets, replaceConnection } from "./repository";
import { resolveMailboxProvider } from "./registry";
import { canReadMailbox, missingScopes, scopesFor, type ScopeGroup } from "./scopes";
import type { OAuthMailboxProvider } from "./types";

const log = createLogger({ scope: "mailbox.connect" });

/** A new OAuth mailbox starts modest: enough to prove the setup, well under any provider's own daily cap. Raising it is approval-gated. */
export const DEFAULT_OAUTH_DAILY_LIMIT = 50;

export class ConnectError extends Error {
  constructor(readonly code: ConnectErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "ConnectError";
  }
}

export type ConnectDeps = { oauth: (p: OAuthMailboxProvider) => OAuthProviderClient; now: () => Date; redirectUri: (p: OAuthMailboxProvider) => string };
const defaults: ConnectDeps = { oauth: getOAuthClient, now: () => new Date(), redirectUri: (p) => redirectUriFor(p) };

export type StartInput = { workspaceId: number; userId: number; provider: OAuthMailboxProvider; mailboxId?: number | null; scopeGroups?: ScopeGroup[] };
export type StartResult = { authorizeUrl: string; cookie: { name: string; value: string; maxAge: number } };

/** Step 1: build the provider's consent URL and the sealed cookie that lets only this user, in this workspace, finish the flow. */
export async function startConnect(input: StartInput, deps: ConnectDeps = defaults): Promise<StartResult> {
  const oauth = deps.oauth(input.provider);
  if (!oauth.isConfigured()) throw new ConnectError("not_configured");

  let loginHint: string | undefined;
  const groups = new Set<ScopeGroup>(input.scopeGroups ?? ["send"]);
  if (input.mailboxId) {
    const target = await loadSecrets(input.workspaceId, input.mailboxId);
    if (!target || target.provider !== input.provider) throw new ConnectError("target_missing");
    loginHint = target.email;
    if (canReadMailbox(input.provider, target.scopes)) groups.add("inbox"); // don't silently downgrade a mailbox that already reads mail
  }

  const { verifier, challenge } = pkcePair();
  const nonce = newNonce();
  const scopeGroups = [...groups];
  const authorizeUrl = oauth.buildAuthorizeUrl({ redirectUri: deps.redirectUri(input.provider), state: nonce, codeChallenge: challenge, scopes: scopesFor(input.provider, scopeGroups), loginHint });
  const value = sealFlowState({
    nonce, provider: input.provider, workspaceId: input.workspaceId, userId: input.userId, mailboxId: input.mailboxId ?? null, scopeGroups,
    codeVerifier: verifier, expiresAt: deps.now().getTime() + FLOW_TTL_SECONDS * 1000,
  });
  return { authorizeUrl, cookie: { name: FLOW_COOKIE, value, maxAge: FLOW_TTL_SECONDS } };
}

export type CompleteInput = {
  workspaceId: number;
  userId: number;
  provider: OAuthMailboxProvider;
  query: { code: string | null; state: string | null; error: string | null };
  cookie: string | undefined;
};
export type CompleteResult = { mailboxId: number; email: string; outcome: "connected" | "reconnected" };

/** A token source for the moment before a mailbox exists: it can vouch for the freshly issued token, never refresh it. */
const justIssued = (accessToken: string): AccessTokenSource => ({
  getAccessToken: async () => accessToken,
  refresh: async () => {
    throw new MailProviderError("The provider rejected the new sign-in", "auth", "just_issued_rejected");
  },
});

/**
 * Step 2: the provider redirected back. Validate everything, learn who signed in, then create or renew the mailbox.
 *
 * Order matters: CSRF/ownership of the flow → provider errors → code exchange → granted scopes → the provider's own statement of
 * who signed in → which mailbox that is. Only the last step writes, and it writes only ciphertext.
 */
export async function completeConnect(input: CompleteInput, deps: ConnectDeps = defaults): Promise<CompleteResult> {
  let flow;
  try {
    flow = openFlowState(input.cookie, { state: input.query.state, provider: input.provider, workspaceId: input.workspaceId, userId: input.userId, now: deps.now().getTime() });
  } catch (e) {
    if (e instanceof FlowError) throw new ConnectError(e.code);
    throw e;
  }
  if (input.query.error) throw new ConnectError(input.query.error === "access_denied" ? "access_denied" : "exchange_failed", input.query.error);
  if (!input.query.code) throw new ConnectError("exchange_failed", "no authorization code");

  const oauth = deps.oauth(input.provider);
  let tokens;
  try {
    tokens = await oauth.exchangeCode({ code: input.query.code, redirectUri: deps.redirectUri(input.provider), codeVerifier: flow.codeVerifier });
  } catch (e) {
    if (e instanceof OAuthError) throw new ConnectError(e.kind === "transient" ? "provider_error" : e.kind === "not_configured" ? "not_configured" : e.kind === "access_denied" ? "access_denied" : "exchange_failed", e.message);
    throw e;
  }

  // Granular consent lets the user untick the send permission; what was GRANTED decides, not what we asked for.
  const granted = tokens.scopes.length > 0 ? tokens.scopes : scopesFor(input.provider, flow.scopeGroups);
  if (missingScopes(input.provider, granted).length > 0) throw new ConnectError("scope_missing");

  let profile;
  try {
    profile = await resolveMailboxProvider(input.provider, { workspaceId: input.workspaceId, mailboxId: flow.mailboxId ?? 0, email: "", displayName: null, scopes: granted }, justIssued(tokens.accessToken)).getProfile();
  } catch (e) {
    log.warn("mailbox.connect.profile_failed", { workspace_id: input.workspaceId, provider: input.provider, err: e });
    throw new ConnectError("provider_error");
  }
  if (!profile.emailVerified) throw new ConnectError("email_unverified");

  const email = profile.email.toLowerCase();
  const creds = { accessTokenEnc: encryptSecret(tokens.accessToken), refreshTokenEnc: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null, tokenExpiresAt: tokens.expiresAt, scopes: granted, displayName: profile.displayName };

  // Which mailbox is this? The one being reconnected, or the one already connected for this provider account, or a new one.
  const target = flow.mailboxId ? await loadSecrets(input.workspaceId, flow.mailboxId) : null;
  if (flow.mailboxId) {
    if (!target || target.provider !== input.provider) throw new ConnectError("target_missing");
    // Reconnecting must mean the SAME account: otherwise campaigns would start sending from someone else's mailbox under the old address.
    if (target.providerAccountId !== profile.providerAccountId || target.email.toLowerCase() !== email) throw new ConnectError("identity_mismatch");
  }
  const existing = target ? { id: target.id } : await findByAccount(input.workspaceId, input.provider, profile.providerAccountId);

  if (existing) {
    const before = target ?? (await loadSecrets(input.workspaceId, existing.id));
    if (!creds.refreshTokenEnc && !before?.refreshTokenEnc) throw new ConnectError("no_refresh_token");
    if (!(await replaceConnection(input.workspaceId, existing.id, creds))) throw new ConnectError("target_missing");
    await logActivity({ workspaceId: input.workspaceId, actorUserId: input.userId, type: "mailbox.reconnected", entityType: "mailbox", entityId: existing.id, summary: `Reconnected mailbox ${email}`, metadata: { provider: input.provider } });
    return { mailboxId: existing.id, email, outcome: "reconnected" };
  }

  if (!creds.refreshTokenEnc) throw new ConnectError("no_refresh_token");
  if (await findByEmail(input.workspaceId, email)) throw new ConnectError("address_in_use");
  let mailboxId: number;
  try {
    mailboxId = await insertConnection(input.workspaceId, { provider: input.provider, email, providerAccountId: profile.providerAccountId, ownerUserId: input.userId, dailyLimit: DEFAULT_OAUTH_DAILY_LIMIT, ...creds });
  } catch (e) {
    if (/duplicate key|unique/i.test(e instanceof Error ? e.message : "")) throw new ConnectError("address_in_use"); // two connects raced
    throw e;
  }
  await logActivity({ workspaceId: input.workspaceId, actorUserId: input.userId, type: "mailbox.connected", entityType: "mailbox", entityId: mailboxId, summary: `Connected ${input.provider === "gmail" ? "Google" : "Microsoft"} mailbox ${email}`, metadata: { provider: input.provider } });
  return { mailboxId, email, outcome: "connected" };
}
