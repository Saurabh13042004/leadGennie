import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createLogger } from "@/lib/log";
import type { AccessTokenSource, MailboxRef } from "@/lib/email/mailbox-provider";
import { MailProviderError } from "@/lib/email/provider";
import { markReconnectRequired } from "./lifecycle";
import { getOAuthClient } from "./oauth/registry";
import { OAuthError, type OAuthProviderClient } from "./oauth/types";
import { loadSecrets, saveRefreshedTokens, type MailboxSecrets } from "./repository";
import type { OAuthMailboxProvider } from "./types";

const log = createLogger({ scope: "mailbox.token" });

/** Refresh a little early so a token never expires mid-request. */
const EXPIRY_SKEW_MS = 60_000;

export type CredentialStore = {
  load(workspaceId: number, mailboxId: number): Promise<MailboxSecrets | null>;
  /** Compare-and-swap on the token version. False = someone else refreshed first. */
  saveRefreshed(workspaceId: number, mailboxId: number, expectedVersion: number, t: { accessToken: string; refreshToken: string | null; expiresAt: Date; scopes: string[] }): Promise<boolean>;
};

/** The database-backed store: ciphertext at rest, plaintext only inside this module's call stack. */
export const dbCredentialStore: CredentialStore = {
  load: loadSecrets,
  saveRefreshed: (workspaceId, mailboxId, version, t) =>
    saveRefreshedTokens(workspaceId, mailboxId, version, {
      accessTokenEnc: encryptSecret(t.accessToken), refreshTokenEnc: t.refreshToken ? encryptSecret(t.refreshToken) : null, expiresAt: t.expiresAt, scopes: t.scopes,
    }),
};

export type TokenSourceDeps = {
  store: CredentialStore;
  oauth: OAuthProviderClient;
  now: () => Date;
  /** The grant is dead: the mailbox must be reconnected by a person. */
  onReconnectRequired: (workspaceId: number, mailboxId: number, reason: string) => Promise<unknown>;
};

/**
 * Hands a provider adapter a valid access token for one mailbox, refreshing it (and persisting the result) when it is about to
 * expire or the provider rejected it. The adapter never sees a refresh token or the database.
 *
 * Failure semantics — what each one means for the caller:
 *   grant revoked/expired (`invalid_grant`)  → mailbox becomes `reconnect_required`, throws `auth` (campaigns pause, UI says Reconnect)
 *   provider/network hiccup                  → throws `retryable`; the mailbox is untouched, the send retries
 *   our own client id/secret rejected        → throws `domain` (a setup problem on this server, not the user's fault)
 * Nothing here logs a token, a code or a client secret — only ids and the provider's short error code.
 */
export class MailboxTokenSource implements AccessTokenSource {
  constructor(
    private readonly ref: Pick<MailboxRef, "workspaceId" | "mailboxId">,
    private readonly deps: TokenSourceDeps,
  ) {}

  async getAccessToken(): Promise<string> {
    const c = await this.load();
    if (c.accessTokenEnc && c.tokenExpiresAt && c.tokenExpiresAt.getTime() - EXPIRY_SKEW_MS > this.deps.now().getTime()) return decryptSecret(c.accessTokenEnc);
    return this.refreshFrom(c);
  }

  async refresh(): Promise<string> {
    return this.refreshFrom(await this.load());
  }

  private async load(): Promise<MailboxSecrets> {
    const c = await this.deps.store.load(this.ref.workspaceId, this.ref.mailboxId);
    if (!c) throw new MailProviderError("Mailbox not found", "auth", "mailbox_missing");
    if (c.status !== "active" && c.status !== "error") throw new MailProviderError(`The mailbox is ${c.status.replace("_", " ")}`, "auth", "mailbox_not_connected");
    if (!c.accessTokenEnc && !c.refreshTokenEnc) throw new MailProviderError("The mailbox has no stored sign-in", "auth", "no_credentials");
    return c;
  }

  private async refreshFrom(c: MailboxSecrets, retried = false): Promise<string> {
    if (!c.refreshTokenEnc) return this.dead("no refresh token stored");
    let tokens;
    try {
      tokens = await this.deps.oauth.refresh(decryptSecret(c.refreshTokenEnc));
    } catch (e) {
      if (!(e instanceof OAuthError)) throw new MailProviderError("Couldn't refresh the mailbox sign-in", "retryable", "token_refresh_failed");
      if (e.kind === "invalid_grant") return this.dead(e.message);
      if (e.kind === "transient") throw new MailProviderError(e.message, "retryable", "token_refresh_failed");
      throw new MailProviderError(`The server's ${c.provider} sign-in settings were rejected: ${e.message}`, "domain", "oauth_client_rejected");
    }
    if (await this.deps.store.saveRefreshed(this.ref.workspaceId, this.ref.mailboxId, c.tokenVersion, tokens)) {
      log.info("mailbox.token_refreshed", { workspace_id: this.ref.workspaceId, mailbox_id: this.ref.mailboxId, provider: c.provider });
      return tokens.accessToken;
    }
    // Lost the race: another worker refreshed (or the mailbox was disconnected) between our read and write. Use theirs.
    const latest = await this.load();
    if (latest.accessTokenEnc && latest.tokenExpiresAt && latest.tokenExpiresAt.getTime() - EXPIRY_SKEW_MS > this.deps.now().getTime()) return decryptSecret(latest.accessTokenEnc);
    if (retried) throw new MailProviderError("Couldn't store the refreshed sign-in", "retryable", "token_save_conflict");
    return this.refreshFrom(latest, true);
  }

  private async dead(reason: string): Promise<never> {
    await this.deps.onReconnectRequired(this.ref.workspaceId, this.ref.mailboxId, reason);
    throw new MailProviderError("The mailbox sign-in is no longer valid", "auth", "invalid_grant");
  }
}

/** The wiring used in production: database credentials, the real OAuth client for the mailbox's provider, the real clock. */
export function tokenSourceFor(ref: Pick<MailboxRef, "workspaceId" | "mailboxId">, provider: OAuthMailboxProvider): AccessTokenSource {
  return new MailboxTokenSource(ref, { store: dbCredentialStore, oauth: getOAuthClient(provider), now: () => new Date(), onReconnectRequired: markReconnectRequired });
}
