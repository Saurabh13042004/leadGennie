import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createUser, createWorkspace } from "../helpers/factories";
import { createOAuthMailbox, installMailboxFakes } from "../helpers/mailboxes";
import { completeConnect, ConnectError, startConnect, DEFAULT_OAUTH_DAILY_LIMIT } from "@/lib/domain/mailboxes/connect-service";
import { OAuthError } from "@/lib/domain/mailboxes/oauth/types";
import { decryptSecret } from "@/lib/crypto";
import { listMailboxes } from "@/lib/domain/mailboxes/repository";
import { GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE } from "@/lib/domain/mailboxes/scopes";
import type { ConnectErrorCode } from "@/lib/domain/mailboxes/oauth/messages";

const { oauth, providers } = installMailboxFakes();

type Ctx = { workspaceId: number; userId: number };
let A: Ctx;
let B: Ctx;

beforeEach(async () => {
  await resetDb();
  const a = await createWorkspace();
  const b = await createWorkspace();
  A = { workspaceId: a.workspaceId, userId: a.user.id };
  B = { workspaceId: b.workspaceId, userId: b.user.id };
});

/** Runs the whole flow as the app does: start (cookie + consent URL), then the provider's redirect back. */
async function connect(ctx: Ctx, opts: { provider?: "gmail" | "microsoft"; mailboxId?: number; code?: string | null; error?: string | null; state?: (nonce: string) => string | null } = {}) {
  const provider = opts.provider ?? "gmail";
  const started = await startConnect({ ...ctx, provider, mailboxId: opts.mailboxId });
  const nonce = new URL(started.authorizeUrl).searchParams.get("state")!;
  return completeConnect({
    ...ctx, provider, query: { code: opts.code === undefined ? "auth-code" : opts.code, state: opts.state ? opts.state(nonce) : nonce, error: opts.error ?? null }, cookie: started.cookie.value,
  });
}
const refusal = async (p: Promise<unknown>) => (await p.then(() => null, (e) => e)) as ConnectError | null;
const code = async (p: Promise<unknown>) => (await refusal(p))?.code as ConnectErrorCode | undefined;

describe("connecting a mailbox", () => {
  it("creates a connected Gmail mailbox for the signed-in user, with the tokens encrypted at rest", async () => {
    const done = await connect(A);
    expect(done).toMatchObject({ outcome: "connected", email: "me@acme.com" });

    const [row] = await sql`select * from mailboxes where id = ${done.mailboxId}`;
    expect(row).toMatchObject({ workspace_id: String(A.workspaceId), provider: "gmail", status: "active", email: "me@acme.com", display_name: "Ada", provider_account_id: "g-123", daily_limit: DEFAULT_OAUTH_DAILY_LIMIT, owner_user_id: String(A.userId), domain_id: null });
    expect(row.scopes).toEqual(["openid", "email", "profile", GMAIL_SEND_SCOPE]);
    // ciphertext, not the token — and it decrypts back to it
    expect(String(row.access_token_enc)).not.toContain("access-1");
    expect(String(row.refresh_token_enc)).not.toContain("refresh-1");
    expect(decryptSecret(String(row.access_token_enc))).toBe("access-1");
    expect(decryptSecret(String(row.refresh_token_enc))).toBe("refresh-1");

    const [act] = await sql`select type, summary, actor_user_id from activities where entity_type = 'mailbox' and entity_id = ${done.mailboxId}`;
    expect(act).toMatchObject({ type: "mailbox.connected", actor_user_id: String(A.userId) });
    expect(JSON.stringify(await sql`select * from activities`)).not.toMatch(/access-1|refresh-1|auth-code/);
  });

  it("uses the PKCE verifier and asks only for identity + send scopes", async () => {
    await connect(A);
    expect(oauth.gmail.exchangeCalls).toHaveLength(1);
    expect(oauth.gmail.exchangeCalls[0].codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(oauth.gmail.authorizeCalls[0].scopes).toEqual(["openid", "email", "profile", GMAIL_SEND_SCOPE]);
  });

  it("connects Microsoft the same way", async () => {
    const done = await connect(A, { provider: "microsoft" });
    expect(done.email).toBe("ada@contoso.com");
    const [row] = await sql`select provider, provider_account_id from mailboxes where id = ${done.mailboxId}`;
    expect(row).toMatchObject({ provider: "microsoft", provider_account_id: "ms-123" });
  });

  it("never returns credentials to the UI layer", async () => {
    await connect(A);
    const list = await listMailboxes(A.workspaceId);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ provider: "gmail", status: "active", sendable: true, blockedReason: null, sentToday: 0, dailyLimit: 50 });
    expect(JSON.stringify(list)).not.toMatch(/access-1|refresh-1|_enc|token/i);
  });

  it("connecting the same account again reconnects it instead of duplicating", async () => {
    const first = await connect(A);
    const second = await connect(A);
    expect(second).toMatchObject({ mailboxId: first.mailboxId, outcome: "reconnected" });
    expect(await sql`select id from mailboxes where workspace_id = ${A.workspaceId}`).toHaveLength(1);
  });

  it("the same Google account can be connected in two different workspaces — each gets its own mailbox", async () => {
    const a = await connect(A);
    const b = await connect(B);
    expect(b.mailboxId).not.toBe(a.mailboxId);
    expect((await listMailboxes(A.workspaceId)).map((m) => m.id)).toEqual([a.mailboxId]);
    expect((await listMailboxes(B.workspaceId)).map((m) => m.id)).toEqual([b.mailboxId]);
  });
});

describe("refusing a bad callback", () => {
  it.each<[string, (nonce: string) => string | null]>([
    ["a missing state", () => null],
    ["a state that isn't the one we issued (CSRF)", () => "attacker-nonce"],
  ])("%s", async (_n, state) => {
    expect(await code(connect(A, { state }))).toBe("state_invalid");
    expect(oauth.gmail.exchangeCalls).toHaveLength(0); // never even talked to the provider
    expect(await sql`select id from mailboxes`).toHaveLength(0);
  });

  it("a cookie with no callback state, or no cookie at all", async () => {
    const s = await startConnect({ ...A, provider: "gmail" });
    expect(await code(completeConnect({ ...A, provider: "gmail", query: { code: "c", state: null, error: null }, cookie: s.cookie.value }))).toBe("state_invalid");
    expect(await code(completeConnect({ ...A, provider: "gmail", query: { code: "c", state: "x", error: null }, cookie: undefined }))).toBe("state_invalid");
  });

  it("a flow started by another user, in another workspace, or for the other provider", async () => {
    const s = await startConnect({ ...A, provider: "gmail" });
    const nonce = new URL(s.authorizeUrl).searchParams.get("state")!;
    const q = { code: "c", state: nonce, error: null };
    const other = await createUser();
    expect(await code(completeConnect({ workspaceId: A.workspaceId, userId: other.id, provider: "gmail", query: q, cookie: s.cookie.value }))).toBe("state_mismatch");
    expect(await code(completeConnect({ workspaceId: B.workspaceId, userId: A.userId, provider: "gmail", query: q, cookie: s.cookie.value }))).toBe("state_mismatch");
    expect(await code(completeConnect({ ...A, provider: "microsoft", query: q, cookie: s.cookie.value }))).toBe("state_mismatch");
    expect(oauth.gmail.exchangeCalls).toHaveLength(0);
  });

  it("an expired flow", async () => {
    const s = await startConnect({ ...A, provider: "gmail" }, { oauth: () => oauth.gmail, now: () => new Date(Date.now() - 3_600_000), redirectUri: () => "https://app.test/cb" });
    const nonce = new URL(s.authorizeUrl).searchParams.get("state")!;
    expect(await code(completeConnect({ ...A, provider: "gmail", query: { code: "c", state: nonce, error: null }, cookie: s.cookie.value }))).toBe("state_expired");
  });

  it("the user pressing Cancel, and a provider error", async () => {
    expect(await code(connect(A, { code: null, error: "access_denied" }))).toBe("access_denied");
    expect(await code(connect(A, { code: null, error: "server_error" }))).toBe("exchange_failed");
    expect(await code(connect(A, { code: null }))).toBe("exchange_failed");
  });

  it("a failed code exchange, an outage, and a server without credentials each say something different", async () => {
    oauth.gmail.exchangeResult = new OAuthError("invalid_grant: Bad Request", "invalid_grant");
    expect(await code(connect(A))).toBe("exchange_failed");
    oauth.gmail.exchangeResult = new OAuthError("down", "transient");
    expect(await code(connect(A))).toBe("provider_error");
    oauth.gmail.configured = false;
    expect(await code(startConnect({ ...A, provider: "gmail" }))).toBe("not_configured");
  });

  it("the user unticking the send permission (granular consent)", async () => {
    oauth.gmail.exchangeResult = { accessToken: "a", refreshToken: "r", expiresAt: new Date(Date.now() + 3_600_000), scopes: ["openid", "email"] };
    expect(await code(connect(A))).toBe("scope_missing");
    expect(await sql`select id from mailboxes`).toHaveLength(0);
  });

  it("an address the provider won't vouch for, and a provider that can't say who signed in", async () => {
    providers.gmail.profile = { providerAccountId: "g-1", email: "x@acme.com", displayName: null, emailVerified: false };
    expect(await code(connect(A))).toBe("email_unverified");
    const { MailProviderError } = await import("@/lib/email/provider");
    providers.gmail.profile = new MailProviderError("down", "retryable");
    expect(await code(connect(A))).toBe("provider_error");
  });

  it("no refresh token on a first connection (Google only issues one on consent)", async () => {
    oauth.gmail.exchangeResult = { accessToken: "a", refreshToken: null, expiresAt: new Date(Date.now() + 3_600_000), scopes: [GMAIL_SEND_SCOPE] };
    expect(await code(connect(A))).toBe("no_refresh_token");
    expect(await sql`select id from mailboxes`).toHaveLength(0);
  });

  it("an address already used by another kind of mailbox in this workspace", async () => {
    const [d] = await sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${A.workspaceId}, 'rd1', 'acme.com', 'verified') returning id`;
    await sql`insert into mailboxes (workspace_id, domain_id, email, status) values (${A.workspaceId}, ${d.id}, 'me@acme.com', 'active')`;
    expect(await code(connect(A))).toBe("address_in_use");
  });
});

describe("reconnecting", () => {
  it("renews a mailbox that needs it, keeping its id, limit and history — and clears the error", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com", providerAccountId: "g-123", status: "reconnect_required", dailyLimit: 120 });
    await sql`update mailboxes set last_error = 'invalid_grant' where id = ${mb.id}`;
    const done = await connect(A, { mailboxId: mb.id });
    expect(done).toMatchObject({ mailboxId: mb.id, outcome: "reconnected" });
    const [row] = await sql`select status, last_error, daily_limit, token_version, disconnected_at from mailboxes where id = ${mb.id}`;
    expect(row).toMatchObject({ status: "active", last_error: null, daily_limit: 120, disconnected_at: null });
    expect(Number(row.token_version)).toBeGreaterThan(0);
    expect(oauth.gmail.authorizeCalls[0].loginHint).toBe("me@acme.com");
    expect((await sql`select type from activities where entity_id = ${mb.id}`).map((r) => r.type)).toContain("mailbox.reconnected");
  });

  it("brings a disconnected mailbox back; keeps the old refresh token when the provider issues no new one", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com", providerAccountId: "g-123", status: "active", refreshToken: "refresh-stored" });
    oauth.gmail.exchangeResult = { accessToken: "a2", refreshToken: null, expiresAt: new Date(Date.now() + 3_600_000), scopes: [GMAIL_SEND_SCOPE] };
    await connect(A, { mailboxId: mb.id });
    const [row] = await sql`select refresh_token_enc, access_token_enc from mailboxes where id = ${mb.id}`;
    expect(decryptSecret(String(row.refresh_token_enc))).toBe("refresh-stored");
    expect(decryptSecret(String(row.access_token_enc))).toBe("a2");
  });

  it("a disconnected mailbox (credentials wiped) needs a fresh refresh token to come back", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com", providerAccountId: "g-123", status: "disconnected", accessToken: null, refreshToken: null });
    oauth.gmail.exchangeResult = { accessToken: "a2", refreshToken: null, expiresAt: new Date(Date.now() + 3_600_000), scopes: [GMAIL_SEND_SCOPE] };
    expect(await code(connect(A, { mailboxId: mb.id }))).toBe("no_refresh_token");
  });

  it("must be the SAME account — signing in as someone else is refused and changes nothing", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com", providerAccountId: "g-123", status: "reconnect_required" });
    providers.gmail.profile = { providerAccountId: "g-999", email: "someone.else@acme.com", displayName: "Eve", emailVerified: true };
    expect(await code(connect(A, { mailboxId: mb.id }))).toBe("identity_mismatch");
    const [row] = await sql`select status, email from mailboxes where id = ${mb.id}`;
    expect(row).toMatchObject({ status: "reconnect_required", email: "me@acme.com" });
  });

  it("can't reconnect another workspace's mailbox, or one of the other provider", async () => {
    const theirs = await createOAuthMailbox(B.workspaceId, { email: "me@acme.com", providerAccountId: "g-123" });
    expect(await code(startConnect({ ...A, provider: "gmail", mailboxId: theirs.id }))).toBe("target_missing");
    const ms = await createOAuthMailbox(A.workspaceId, { provider: "microsoft", email: "ada@contoso.com" });
    expect(await code(startConnect({ ...A, provider: "gmail", mailboxId: ms.id }))).toBe("target_missing");
    expect(await code(startConnect({ ...A, provider: "gmail", mailboxId: 999999 }))).toBe("target_missing");
  });

  it("a mailbox that already reads mail keeps asking for that permission when reconnected", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com", providerAccountId: "g-123", scopes: [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE] });
    await startConnect({ ...A, provider: "gmail", mailboxId: mb.id });
    expect(oauth.gmail.authorizeCalls[0].scopes).toContain(GMAIL_READ_SCOPE);
  });
});
