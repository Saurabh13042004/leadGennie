import { describe, expect, it, vi } from "vitest";
import { GmailMailboxProvider, classifyGmailError } from "@/lib/email/gmail-provider";
import { MicrosoftMailboxProvider, classifyGraphError } from "@/lib/email/microsoft-provider";
import { normalizeGmailMessage, parseAddressList, htmlToText } from "@/lib/email/gmail-messages";
import { normalizeGraphMessage } from "@/lib/email/graph-messages";
import { classifyFetchFailure } from "@/lib/email/http";
import { MailProviderError, type MailSendInput } from "@/lib/email/provider";
import type { AccessTokenSource, MailboxRef } from "@/lib/email/mailbox-provider";
import { GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE, GRAPH_READ_SCOPE, GRAPH_SEND_SCOPE } from "@/lib/domain/mailboxes/scopes";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const ref = (scopes: string[]): MailboxRef => ({ workspaceId: 1, mailboxId: 9, email: "me@acme.com", displayName: "Ada", scopes });
const tokens = (): AccessTokenSource & { refreshed: number } => {
  const t = { refreshed: 0, getAccessToken: async () => "tok-1", refresh: async () => { t.refreshed++; return "tok-2"; } };
  return t;
};
const email: MailSendInput = {
  from: "me@acme.com", to: "lead@example.org", subject: "Quick question", text: "Hi Sam", idempotencyKey: "k1",
  headers: { "List-Unsubscribe": "<https://x.test/u>" },
};
const decodeRaw = (init: RequestInit) => Buffer.from(JSON.parse(String(init.body)).raw, "base64url").toString("utf8");
type Call = [string, RequestInit];
const calls = (f: ReturnType<typeof vi.fn>) => f.mock.calls as unknown as Call[];

describe("GmailMailboxProvider.send", () => {
  it("posts a base64url MIME message with the mailbox's display name and the compliance headers, and returns Gmail's ids", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "msg1", threadId: "thr1", labelIds: ["SENT"] }));
    const t = tokens();
    const res = await new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), t, fetchImpl).send({ ...email, threadId: "thr0", inReplyTo: "<a@b>" });
    expect(res).toEqual({ id: "msg1", threadId: "thr1" });
    const [url, init] = calls(fetchImpl)[0];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
    expect(JSON.parse(String(init.body)).threadId).toBe("thr0");
    const mime = decodeRaw(init);
    expect(mime).toContain('From: "Ada" <me@acme.com>');
    expect(mime).toContain("To: lead@example.org");
    expect(mime).toContain("List-Unsubscribe: <https://x.test/u>");
    expect(mime).toContain("In-Reply-To: <a@b>");
  });

  it("refreshes ONCE on a 401 and retries with the new token", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ error: { code: 401 } }, 401)).mockResolvedValueOnce(json({ id: "m", threadId: "t" }));
    const t = tokens();
    await expect(new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), t, fetchImpl).send(email)).resolves.toMatchObject({ id: "m" });
    expect(t.refreshed).toBe(1);
    expect((calls(fetchImpl)[1][1].headers as Record<string, string>).Authorization).toBe("Bearer tok-2");
  });

  it("a second 401 is an auth failure (no refresh loop)", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: 401, message: "Invalid Credentials" } }, 401));
    const t = tokens();
    await expect(new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), t, fetchImpl).send(email)).rejects.toMatchObject({ cls: "auth" });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(t.refreshed).toBe(1);
  });

  it("a token source that gives up (grant revoked) surfaces its auth error, and nothing is sent", async () => {
    const fetchImpl = vi.fn();
    const dead: AccessTokenSource = { getAccessToken: async () => { throw new MailProviderError("dead", "auth", "invalid_grant"); }, refresh: async () => "x" };
    await expect(new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), dead, fetchImpl).send(email)).rejects.toMatchObject({ cls: "auth", code: "invalid_grant" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("a 2xx with no body is still an accepted email — never reported as failed (a retry would duplicate it)", async () => {
    const res = await new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), tokens(), async () => new Response("", { status: 200 })).send(email);
    expect(res).toEqual({ id: null, threadId: null });
  });

  it("a connection lost mid-send is unknown_outcome (it may have gone out); a DNS failure proves it didn't", async () => {
    const reset = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    const dns = Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } });
    const p = (e: Error) => new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), tokens(), async () => { throw e; }).send(email);
    await expect(p(reset)).rejects.toMatchObject({ cls: "unknown_outcome", code: "network_error" });
    await expect(p(dns)).rejects.toMatchObject({ cls: "retryable", code: "network_error" });
  });

  it("refuses header-injection attempts before anything leaves the server", async () => {
    const fetchImpl = vi.fn();
    await expect(new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), tokens(), fetchImpl).send({ ...email, subject: "x\r\nBcc: a@b.co" })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("advertises what it can do: no idempotency key, threads, and inbox only with the read scope", () => {
    const send = new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), tokens(), vi.fn());
    expect(send.name).toBe("gmail");
    expect(send.capabilities).toEqual({ idempotencyKey: false, oneClickUnsubscribeHeaders: true, threading: true, inboxSync: false });
    expect(new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE]), tokens(), vi.fn()).capabilities.inboxSync).toBe(true);
    expect(send.isConfigured()).toBe(true);
    expect(new GmailMailboxProvider(ref([]), tokens(), vi.fn(), () => false).isConfigured()).toBe(false);
  });
});

describe("Gmail error classification", () => {
  const e = (status: number, reason = "", message = "") => classifyGmailError(status, { error: { code: status, message, errors: [{ reason }] } });
  it.each([
    [401, "", "", "auth"],
    [403, "insufficientPermissions", "Insufficient Permission", "auth"],
    [403, "rateLimitExceeded", "Rate Limit Exceeded", "rate_limited"],
    [403, "dailyLimitExceeded", "Daily Limit Exceeded", "quota"],
    [429, "", "User-rate limit exceeded", "rate_limited"],
    [429, "", "Daily user sending quota exceeded", "quota"],
    [403, "accessNotConfigured", "Gmail API has not been used in project", "domain"],
    [400, "failedPrecondition", "Precondition check failed", "domain"],
    [400, "invalidArgument", "Invalid To header", "permanent"],
    [404, "", "Requested entity was not found", "auth"],
    [500, "backendError", "", "unknown_outcome"],
    [503, "", "", "unknown_outcome"],
  ])("%s %s → %s", (status, reason, message, cls) => {
    expect(e(status, reason, message).cls).toBe(cls);
  });
  it("honours Retry-After on throttling", () => {
    expect(classifyGmailError(429, {}, 42).retryAfterSeconds).toBe(42);
  });
});

describe("MicrosoftMailboxProvider", () => {
  it("sends MIME to Graph (so List-Unsubscribe survives) and honestly reports no message id on a 202", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 202 }));
    const res = await new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), tokens(), fetchImpl).send(email);
    expect(res).toEqual({ id: null, threadId: null });
    const [url, init] = calls(fetchImpl)[0];
    expect(url).toBe("https://graph.microsoft.com/v1.0/me/sendMail");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("text/plain");
    const mime = Buffer.from(String(init.body), "base64").toString("utf8");
    expect(mime).toContain('From: "Ada" <me@acme.com>');
    expect(mime).toContain("List-Unsubscribe: <https://x.test/u>");
  });

  it("refreshes once on 401, then reports auth if it is still rejected", async () => {
    const t = tokens();
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({ error: { code: "InvalidAuthenticationToken" } }, 401)).mockResolvedValueOnce(new Response(null, { status: 202 }));
    await expect(new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), t, fetchImpl).send(email)).resolves.toBeDefined();
    expect(t.refreshed).toBe(1);
    const t2 = tokens();
    await expect(new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), t2, async () => json({ error: { code: "InvalidAuthenticationToken" } }, 401)).send(email)).rejects.toMatchObject({ cls: "auth" });
  });

  it("getProfile uses the tenant-provisioned `mail` as proof of a real mailbox", async () => {
    const ok = new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), tokens(), async () => json({ id: "oid-1", displayName: "Ada", mail: "Ada@Acme.com", userPrincipalName: "ada@acme.onmicrosoft.com" }));
    await expect(ok.getProfile()).resolves.toEqual({ providerAccountId: "oid-1", email: "ada@acme.com", displayName: "Ada", emailVerified: true });
    const none = new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), tokens(), async () => json({ id: "oid-2", mail: null, userPrincipalName: "x@acme.onmicrosoft.com" }));
    await expect(none.getProfile()).resolves.toMatchObject({ emailVerified: false });
  });

  it("capabilities: no idempotency, no threading on send, inbox only with Mail.Read", () => {
    expect(new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), tokens(), vi.fn()).capabilities).toEqual({ idempotencyKey: false, oneClickUnsubscribeHeaders: true, threading: false, inboxSync: false });
    expect(new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE, GRAPH_READ_SCOPE]), tokens(), vi.fn()).capabilities.inboxSync).toBe(true);
  });
});

describe("Graph error classification", () => {
  const e = (status: number, code = "") => classifyGraphError(status, { error: { code, message: "m" } }).cls;
  it.each([
    [401, "InvalidAuthenticationToken", "auth"],
    [403, "ErrorAccessDenied", "auth"],
    [429, "TooManyRequests", "rate_limited"],
    [400, "ErrorSendQuotaExceeded", "quota"],
    [404, "MailboxNotEnabledForRESTAPI", "domain"],
    [404, "", "domain"],
    [400, "ErrorInvalidRecipients", "permanent"],
    [413, "", "permanent"],
    [502, "", "unknown_outcome"],
    [504, "", "unknown_outcome"],
  ])("%s %s → %s", (status, code, cls) => expect(e(status, code)).toBe(cls));
});

describe("reading a mailbox (inbox capability)", () => {
  it("is refused — as an auth problem the user can fix by reconnecting — without the read scope", async () => {
    const g = new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE]), tokens(), vi.fn());
    await expect(g.listMessages!({})).rejects.toMatchObject({ cls: "auth", code: "missing_read_scope" });
    await expect(new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE]), tokens(), vi.fn()).getThread!("c1")).rejects.toMatchObject({ code: "missing_read_scope" });
  });

  it("Gmail: lists the inbox since a time, fetches each message, and returns normalised messages + a cursor", async () => {
    const b64 = (s: string) => Buffer.from(s).toString("base64url");
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes("/messages?")) return json({ messages: [{ id: "g1", threadId: "t1" }], nextPageToken: "page2" });
      return json({ id: "g1", threadId: "t1", labelIds: ["INBOX"], internalDate: "1767225600000", payload: { mimeType: "text/plain", headers: [
        { name: "From", value: '"Sam Lead" <sam@lead.io>' }, { name: "To", value: "me@acme.com" }, { name: "Subject", value: "Re: Quick question" },
        { name: "Message-ID", value: "<r1@lead.io>" }, { name: "In-Reply-To", value: "<sent1@acme>" }, { name: "References", value: "<sent1@acme> <x@y>" },
      ], body: { data: b64("Sounds good, let's talk.") } } });
    });
    const p = new GmailMailboxProvider(ref([GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE]), tokens(), fetchImpl);
    const page = await p.listMessages!({ since: new Date("2026-01-01T00:00:00Z"), limit: 10 });
    expect(new URL(calls(fetchImpl)[0][0]).searchParams.get("q")).toBe("in:inbox after:1767225600");
    expect(page.nextCursor).toBe("page2");
    expect(page.messages[0]).toMatchObject({
      mailboxId: 9, providerMessageId: "g1", providerThreadId: "t1", direction: "in", subject: "Re: Quick question", text: "Sounds good, let's talk.",
      from: { email: "sam@lead.io", name: "Sam Lead" }, inReplyTo: "<sent1@acme>", references: ["<sent1@acme>", "<x@y>"], rfcMessageId: "<r1@lead.io>",
    });
    expect(page.messages[0].receivedAt?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("Microsoft: refuses a paging cursor that points anywhere but Graph (the bearer token would follow it)", async () => {
    const p = new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE, GRAPH_READ_SCOPE]), tokens(), vi.fn());
    await expect(p.listMessages!({ cursor: "https://evil.example/steal" })).rejects.toMatchObject({ code: "bad_cursor" });
  });

  it("Microsoft: thread = the conversation, oldest first, with the ids normalised", async () => {
    const fetchImpl = vi.fn(async () => json({ value: [
      { id: "b", conversationId: "c1", subject: "Re: hi", from: { emailAddress: { name: "Sam", address: "SAM@lead.io" } }, toRecipients: [{ emailAddress: { address: "me@acme.com" } }], receivedDateTime: "2026-02-02T00:00:00Z", body: { contentType: "text", content: "yes" }, internetMessageId: "<b@lead>" },
      { id: "a", conversationId: "c1", subject: "hi", from: { emailAddress: { address: "me@acme.com" } }, toRecipients: [{ emailAddress: { address: "sam@lead.io" } }], sentDateTime: "2026-02-01T00:00:00Z", body: { contentType: "html", content: "<p>hello</p>" } },
    ] }));
    const t = await new MicrosoftMailboxProvider(ref([GRAPH_SEND_SCOPE, GRAPH_READ_SCOPE]), tokens(), fetchImpl).getThread!("c1");
    expect(t.messages.map((m) => [m.providerMessageId, m.direction])).toEqual([["a", "out"], ["b", "in"]]);
    expect(t.messages[0].text).toBe("hello");
    expect(t.messages[1].from?.email).toBe("sam@lead.io");
    expect(new URL(calls(fetchImpl)[0][0]).searchParams.get("$filter")).toBe("conversationId eq 'c1'");
  });
});

describe("normalisation helpers", () => {
  it("parses address lists with quoted commas and drops junk", () => {
    expect(parseAddressList('"Lovelace, Ada" <ada@x.io>, bob@y.io, undisclosed-recipients:;')).toEqual([{ email: "ada@x.io", name: "Lovelace, Ada" }, { email: "bob@y.io", name: null }]);
    expect(parseAddressList(undefined)).toEqual([]);
  });
  it("marks a message we sent as outgoing", () => {
    const m = normalizeGmailMessage({ id: "1", labelIds: ["SENT"], payload: { headers: [{ name: "From", value: "me@acme.com" }] } }, { id: 1, email: "me@acme.com" });
    expect(m.direction).toBe("out");
    expect(normalizeGraphMessage({ id: "1", from: { emailAddress: { address: "me@acme.com" } } }, { id: 1, email: "me@acme.com" }).direction).toBe("out");
  });
  it("turns HTML-only mail into readable text and drops scripts", () => {
    expect(htmlToText("<style>x{}</style><p>Hi&nbsp;there</p><script>alert(1)</script><p>Bye</p>")).toBe("Hi there\nBye");
  });
  it("classifyFetchFailure: reads are always retryable", () => {
    expect(classifyFetchFailure(new Error("reset"), false).cls).toBe("retryable");
    expect(classifyFetchFailure(new Error("reset"), true).cls).toBe("unknown_outcome");
  });
});
