import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createLead, createWorkspace } from "../helpers/factories";
import { createOAuthMailbox, installMailboxFakes } from "../helpers/mailboxes";
import { setSession } from "../helpers/session";
import { decryptSecret } from "@/lib/crypto";
import { MailboxTokenSource, dbCredentialStore } from "@/lib/domain/mailboxes/token-source";
import { markReconnectRequired } from "@/lib/domain/mailboxes/lifecycle";
import { OAuthError } from "@/lib/domain/mailboxes/oauth/types";
import { MailProviderError } from "@/lib/email/provider";
import { disconnectMailbox as disconnectAction, pauseMailbox, resumeMailbox, removeMailbox, testMailbox, listMailboxes, listSendableMailboxes } from "@/lib/actions/mailboxes";

const { oauth, providers } = installMailboxFakes();

let A: { workspaceId: number; user: { id: number; email: string } };
let B: { workspaceId: number; user: { id: number; email: string } };
const as = (w: typeof A, role: "owner" | "admin" | "member" | "viewer" = "owner") => setSession({ workspaceId: w.workspaceId, userId: w.user.id, email: w.user.email, role });

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  as(A);
});

const source = (mailboxId: number, now = () => new Date()) =>
  new MailboxTokenSource({ workspaceId: A.workspaceId, mailboxId }, { store: dbCredentialStore, oauth: oauth.gmail, now, onReconnectRequired: markReconnectRequired });

async function runningCampaign(workspaceId: number, mailboxId: number, name = "Outbound") {
  const [c] = await sql`insert into campaigns (workspace_id, name, status, mailbox_id, from_email) values (${workspaceId}, ${name}, 'running', ${mailboxId}, 'x@y.z') returning id`;
  return Number(c.id);
}
const status = async (id: number) => String((await sql`select status from mailboxes where id = ${id}`)[0].status);

describe("access token refresh", () => {
  it("uses the stored token while it is fresh — no provider call", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "access-stored", expiresInMs: 30 * 60_000 });
    expect(await source(mb.id).getAccessToken()).toBe("access-stored");
    expect(oauth.gmail.refreshCalls).toHaveLength(0);
  });

  it("refreshes an expired (or nearly expired) token, stores the new one encrypted, and bumps the version", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "old", expiresInMs: 10_000 }); // inside the 60s skew
    const token = await source(mb.id).getAccessToken();
    expect(token).toBe("access-refreshed-1");
    expect(oauth.gmail.refreshCalls).toEqual(["refresh-stored"]);
    const [row] = await sql`select access_token_enc, refresh_token_enc, token_version, token_expires_at from mailboxes where id = ${mb.id}`;
    expect(decryptSecret(String(row.access_token_enc))).toBe("access-refreshed-1");
    expect(decryptSecret(String(row.refresh_token_enc))).toBe("refresh-stored"); // Google issues no new refresh token: keep ours
    expect(String(row.access_token_enc)).not.toContain("access-refreshed-1");
    expect(Number(row.token_version)).toBe(1);
    expect(new Date(String(row.token_expires_at)).getTime()).toBeGreaterThan(Date.now() + 30 * 60_000);
    // the next call is served from storage
    expect(await source(mb.id).getAccessToken()).toBe("access-refreshed-1");
    expect(oauth.gmail.refreshCalls).toHaveLength(1);
  });

  it("stores the rotated refresh token when the provider issues one (Microsoft)", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { provider: "microsoft", email: "ada@contoso.com", accessToken: "old", expiresInMs: -1000 });
    oauth.microsoft.refreshScript.push({ accessToken: "ms-a2", refreshToken: "ms-r2", expiresAt: new Date(Date.now() + 3_600_000), scopes: [] });
    await new MailboxTokenSource({ workspaceId: A.workspaceId, mailboxId: mb.id }, { store: dbCredentialStore, oauth: oauth.microsoft, now: () => new Date(), onReconnectRequired: markReconnectRequired }).getAccessToken();
    const [row] = await sql`select refresh_token_enc from mailboxes where id = ${mb.id}`;
    expect(decryptSecret(String(row.refresh_token_enc))).toBe("ms-r2");
  });

  it("explicit refresh() (the provider said 401) always calls the provider", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { expiresInMs: 3_600_000 });
    expect(await source(mb.id).refresh()).toBe("access-refreshed-1");
  });

  it("two workers refreshing at once: exactly one token is stored and both callers get a usable token", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "old", expiresInMs: -1000 });
    const [t1, t2] = await Promise.all([source(mb.id).getAccessToken(), source(mb.id).getAccessToken()]);
    expect(t1).toMatch(/^access-refreshed-/);
    expect(t2).toMatch(/^access-refreshed-/);
    const [row] = await sql`select access_token_enc, token_version from mailboxes where id = ${mb.id}`;
    expect(Number(row.token_version)).toBe(1); // one winner wrote; the loser re-read the winner's token instead of overwriting it
    expect([t1, t2]).toContain(decryptSecret(String(row.access_token_enc)));
  });

  it("a revoked/expired grant marks the mailbox RECONNECT_REQUIRED, logs it, pauses its campaigns — and says auth", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "old", expiresInMs: -1000 });
    const other = await createOAuthMailbox(A.workspaceId, { email: "other@acme.com" });
    const c1 = await runningCampaign(A.workspaceId, mb.id, "Uses mailbox");
    const c2 = await runningCampaign(A.workspaceId, other.id, "Other mailbox");
    oauth.gmail.refreshScript.push(new OAuthError("invalid_grant: Token has been expired or revoked.", "invalid_grant"));

    await expect(source(mb.id).getAccessToken()).rejects.toMatchObject({ name: "MailProviderError", cls: "auth" });

    const [row] = await sql`select status, last_error from mailboxes where id = ${mb.id}`;
    expect(row.status).toBe("reconnect_required");
    expect(row.last_error).toMatch(/invalid_grant/);
    const acts = await sql`select type, actor_user_id, summary from activities where entity_type = 'mailbox' and entity_id = ${mb.id}`;
    expect(acts).toEqual([expect.objectContaining({ type: "mailbox.auth_failed", actor_user_id: null })]);
    expect(JSON.stringify(acts)).not.toMatch(/refresh-stored|access/);
    const [p1] = await sql`select status, paused_reason from campaigns where id = ${c1}`;
    expect(p1.status).toBe("paused");
    expect(String(p1.paused_reason)).toMatch(/needs to be reconnected/);
    expect((await sql`select status from campaigns where id = ${c2}`)[0].status).toBe("running"); // a different mailbox is untouched
    // and it stays down: no more provider calls, no second audit entry
    await expect(source(mb.id).getAccessToken()).rejects.toMatchObject({ cls: "auth", code: "mailbox_not_connected" });
    expect(oauth.gmail.refreshCalls).toHaveLength(1);
    expect(await sql`select id from activities where entity_id = ${mb.id} and type = 'mailbox.auth_failed'`).toHaveLength(1);
  });

  it("a provider hiccup while refreshing is retryable and leaves the mailbox alone", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "old", expiresInMs: -1000 });
    oauth.gmail.refreshScript.push(new OAuthError("HTTP 503", "transient"));
    await expect(source(mb.id).getAccessToken()).rejects.toMatchObject({ cls: "retryable", code: "token_refresh_failed" });
    expect(await status(mb.id)).toBe("active");
  });

  it("our own client id/secret being rejected is a setup problem (`domain`), not the user's to reconnect", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { accessToken: "old", expiresInMs: -1000 });
    oauth.gmail.refreshScript.push(new OAuthError("invalid_client: bad secret", "rejected"));
    await expect(source(mb.id).getAccessToken()).rejects.toMatchObject({ cls: "domain" });
    expect(await status(mb.id)).toBe("active");
  });

  it.each(["paused", "disconnected", "reconnect_required"] as const)("refuses to hand out a token for a %s mailbox", async (s) => {
    const mb = await createOAuthMailbox(A.workspaceId, { status: s });
    await expect(source(mb.id).getAccessToken()).rejects.toBeInstanceOf(MailProviderError);
    expect(oauth.gmail.refreshCalls).toHaveLength(0);
  });

  it("another workspace's mailbox id yields nothing", async () => {
    const theirs = await createOAuthMailbox(B.workspaceId);
    await expect(source(theirs.id).getAccessToken()).rejects.toMatchObject({ code: "mailbox_missing" });
  });
});

describe("pause / resume", () => {
  it("pause and resume move only between the legal states, and audit both", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    expect(await pauseMailbox(mb.id)).toEqual({ ok: true, data: null });
    expect(await status(mb.id)).toBe("paused");
    expect(await pauseMailbox(mb.id)).toMatchObject({ ok: false, error: { code: "CONFLICT" } }); // already paused
    expect(await resumeMailbox(mb.id)).toMatchObject({ ok: true });
    expect(await resumeMailbox(mb.id)).toMatchObject({ ok: false, error: { code: "CONFLICT" } }); // already active
    expect((await sql`select type from activities where entity_id = ${mb.id} order by id`).map((r) => r.type)).toEqual(["mailbox.paused", "mailbox.resumed"]);
  });

  it("a disconnected or reconnect-required mailbox can't be resumed into sending", async () => {
    const dead = await createOAuthMailbox(A.workspaceId, { email: "d@acme.com", status: "disconnected" });
    const stale = await createOAuthMailbox(A.workspaceId, { email: "s@acme.com", status: "reconnect_required" });
    expect(await resumeMailbox(dead.id)).toMatchObject({ ok: false });
    expect(await resumeMailbox(stale.id)).toMatchObject({ ok: false });
    expect(await pauseMailbox(dead.id)).toMatchObject({ ok: false });
    expect([await status(dead.id), await status(stale.id)]).toEqual(["disconnected", "reconnect_required"]);
  });

  it("members can't pause; only admins", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    as(A, "member");
    expect(await pauseMailbox(mb.id)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await status(mb.id)).toBe("active");
  });
});

describe("disconnecting", () => {
  it("revokes at Google, deletes the stored credentials, marks it disconnected and pauses running campaigns — history stays", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { refreshToken: "refresh-to-revoke" });
    const cid = await runningCampaign(A.workspaceId, mb.id);
    const lead = await createLead(A.workspaceId);
    await sql`insert into messages (workspace_id, campaign_id, lead_id, mailbox_id, from_email, to_email, provider, idempotency_key, status, sent_at)
              values (${A.workspaceId}, ${cid}, ${lead.id}, ${mb.id}, 'me@acme.com', 'l@x.io', 'gmail', 'k-hist', 'sent', now())`;

    const res = await disconnectAction(mb.id);
    expect(res).toEqual({ ok: true, data: { email: mb.email, campaignsPaused: 1, revoked: true } });
    expect(oauth.gmail.revoked).toEqual(["refresh-to-revoke"]);

    const [row] = await sql`select status, access_token_enc, refresh_token_enc, token_expires_at, disconnected_at from mailboxes where id = ${mb.id}`;
    expect(row).toMatchObject({ status: "disconnected", access_token_enc: null, refresh_token_enc: null, token_expires_at: null });
    expect(row.disconnected_at).not.toBeNull();
    const [c] = await sql`select status, paused_reason from campaigns where id = ${cid}`;
    expect(c.status).toBe("paused");
    expect(String(c.paused_reason)).toMatch(/disconnected/);
    // history is untouched
    expect(await sql`select id from messages where mailbox_id = ${mb.id}`).toHaveLength(1);
    expect(await sql`select id from mailboxes where id = ${mb.id}`).toHaveLength(1);
    const [act] = await sql`select type, summary from activities where entity_type = 'mailbox' and entity_id = ${mb.id}`;
    expect(act.type).toBe("mailbox.disconnected");
    expect(act.summary).toMatch(/paused 1 running campaign/);
    expect(JSON.stringify(await sql`select * from activities`)).not.toContain("refresh-to-revoke");
  });

  it("still disconnects — and forgets the token — when the provider can't be reached to revoke", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    oauth.gmail.revokeError = new OAuthError("down", "transient");
    const res = await disconnectAction(mb.id);
    expect(res).toMatchObject({ ok: true, data: { revoked: false } });
    expect((await sql`select refresh_token_enc, status from mailboxes where id = ${mb.id}`)[0]).toMatchObject({ refresh_token_enc: null, status: "disconnected" });
  });

  it("Microsoft has no revoke endpoint: credentials are deleted locally and it says revoked: false", async () => {
    oauth.microsoft.revoke = undefined;
    const mb = await createOAuthMailbox(A.workspaceId, { provider: "microsoft", email: "ada@contoso.com" });
    expect(await disconnectAction(mb.id)).toMatchObject({ ok: true, data: { revoked: false } });
    expect((await sql`select refresh_token_enc from mailboxes where id = ${mb.id}`)[0].refresh_token_enc).toBeNull();
  });

  it("can't disconnect twice, can't disconnect a Resend mailbox, and only admins may", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    await disconnectAction(mb.id);
    expect(await disconnectAction(mb.id)).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const [d] = await sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${A.workspaceId}, 'rd', 'acme.com', 'verified') returning id`;
    const [r] = await sql`insert into mailboxes (workspace_id, domain_id, email, status) values (${A.workspaceId}, ${d.id}, 'hi@acme.com', 'active') returning id`;
    expect(await disconnectAction(Number(r.id))).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
    const other = await createOAuthMailbox(A.workspaceId, { email: "z@acme.com" });
    as(A, "member");
    expect(await disconnectAction(other.id)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });

  it("removeMailbox deletes Resend mailboxes only — a connected account must be disconnected so history is kept", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    expect(await removeMailbox(mb.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await sql`select id from mailboxes where id = ${mb.id}`).toHaveLength(1);
  });
});

describe("workspace isolation", () => {
  it("A can't see, pause, resume, disconnect or test B's mailbox — and B's row is unchanged", async () => {
    const theirs = await createOAuthMailbox(B.workspaceId, { email: "b@acme.com" });
    const before = JSON.stringify(await sql`select * from mailboxes where id = ${theirs.id}`);
    expect((await listMailboxes()).map((m) => m.id)).not.toContain(theirs.id);
    expect(await pauseMailbox(theirs.id)).toMatchObject({ ok: false });
    expect(await resumeMailbox(theirs.id)).toMatchObject({ ok: false });
    expect(await disconnectAction(theirs.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await testMailbox(theirs.id)).toMatchObject({ ok: false, error: { code: "NOT_FOUND" } });
    expect(await removeMailbox(theirs.id)).toMatchObject({ ok: false });
    expect(JSON.stringify(await sql`select * from mailboxes where id = ${theirs.id}`)).toBe(before);
    expect(providers.gmail.requests).toHaveLength(0);
  });
});

describe("test email", () => {
  it("sends from the mailbox to the signed-in user (never to a lead) and audits it", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { email: "me@acme.com" });
    const res = await testMailbox(mb.id);
    expect(res).toEqual({ ok: true, data: { to: A.user.email } });
    expect(providers.gmail.delivered).toHaveLength(1);
    expect(providers.gmail.delivered[0]).toMatchObject({ from: "me@acme.com", to: A.user.email, subject: "LeadGennie test email" });
    const [act] = await sql`select type, metadata from activities where entity_id = ${mb.id}`;
    expect(act.type).toBe("mailbox.test_sent");
    expect((act.metadata as { providerMessageId: string }).providerMessageId).toBe("fake_msg_1");
  });

  it("explains, in plain words, a mailbox that can't send — without calling the provider", async () => {
    for (const [s, rx] of [["paused", /paused/], ["disconnected", /disconnected/], ["reconnect_required", /reconnected before LeadGennie can continue sending/]] as const) {
      const mb = await createOAuthMailbox(A.workspaceId, { email: `${s}@acme.com`, status: s });
      const res = await testMailbox(mb.id);
      expect(res).toMatchObject({ ok: false, error: { code: "CONFLICT" } });
      expect((res as { error: { message: string } }).error.message).toMatch(rx);
    }
    expect(providers.gmail.requests).toHaveLength(0);
  });

  it("turns a provider failure into a user-friendly message, never the raw error", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    providers.gmail.failNext(new MailProviderError("googleapi: Error 401: Request had invalid authentication credentials ya29.SECRET", "auth", "unauthenticated"));
    const res = (await testMailbox(mb.id)) as { ok: false; error: { message: string } };
    expect(res.error.message).toBe("Your Google mailbox needs to be reconnected before LeadGennie can continue sending.");
    expect(res.error.message).not.toMatch(/ya29|googleapi/);
  });

  it("a passing test recovers a mailbox from `error`", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { status: "error" });
    expect(await testMailbox(mb.id)).toMatchObject({ ok: true });
    expect(await status(mb.id)).toBe("active");
  });

  it("viewers can't send tests", async () => {
    const mb = await createOAuthMailbox(A.workspaceId);
    as(A, "viewer");
    expect(await testMailbox(mb.id)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});

describe("what the UI and campaign picker see", () => {
  it("lists every provider together; only mailboxes that can send are offered to campaigns, each with its reason", async () => {
    const ok = await createOAuthMailbox(A.workspaceId, { email: "ok@acme.com" });
    const stale = await createOAuthMailbox(A.workspaceId, { email: "stale@acme.com", status: "reconnect_required" });
    await createOAuthMailbox(A.workspaceId, { email: "paused@acme.com", status: "paused" });
    const [d] = await sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${A.workspaceId}, 'rd', 'acme.com', 'pending') returning id`;
    await sql`insert into mailboxes (workspace_id, domain_id, email, status) values (${A.workspaceId}, ${d.id}, 'resend@acme.com', 'active')`;

    const all = await listMailboxes();
    expect(all).toHaveLength(4);
    expect(all.find((m) => m.id === stale.id)).toMatchObject({ sendable: false, blockedReason: expect.stringMatching(/reconnected/) });
    expect(all.find((m) => m.email === "resend@acme.com")).toMatchObject({ provider: "resend", sendable: false, blockedReason: expect.stringMatching(/domain/), domainName: "acme.com" });
    expect((await listSendableMailboxes()).map((m) => m.id)).toEqual([ok.id]);
  });

  it("counts today's sends per mailbox (not the whole workspace)", async () => {
    const a = await createOAuthMailbox(A.workspaceId, { email: "a@acme.com" });
    const b = await createOAuthMailbox(A.workspaceId, { email: "b@acme.com" });
    const lead = await createLead(A.workspaceId);
    for (const [mb, n] of [[a, 3], [b, 1]] as const) {
      for (let i = 0; i < n; i++) {
        await sql`insert into messages (workspace_id, lead_id, mailbox_id, from_email, to_email, provider, idempotency_key, status) values (${A.workspaceId}, ${lead.id}, ${mb.id}, 'x@y.z', 'l@x.io', 'gmail', ${`k-${mb.id}-${i}`}, 'sent')`;
      }
    }
    await sql`insert into messages (workspace_id, lead_id, mailbox_id, from_email, to_email, provider, idempotency_key, status) values (${A.workspaceId}, ${lead.id}, ${a.id}, 'x@y.z', 'l@x.io', 'gmail', 'k-failed', 'failed')`;
    const by = Object.fromEntries((await listMailboxes()).map((m) => [m.email, m.sentToday]));
    expect(by).toEqual({ "a@acme.com": 3, "b@acme.com": 1 });
  });
});
