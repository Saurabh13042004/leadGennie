import { describe, expect, it } from "vitest";
import { canTransitionMailbox, isSendable, MAILBOX_STATUSES, MAILBOX_TRANSITIONS, mailboxBlockedReason, isOAuthProvider, type MailboxStatus } from "@/lib/domain/mailboxes/types";
import { canReadMailbox, hasScope, missingScopes, requiredScopes, scopesFor, GMAIL_READ_SCOPE, GMAIL_SEND_SCOPE } from "@/lib/domain/mailboxes/scopes";
import { isAutoReply, matchReply } from "@/lib/domain/mailboxes/replies";
import { connectErrorMessage, CONNECT_ERROR_CODES } from "@/lib/domain/mailboxes/oauth/messages";
import type { EmailMessage } from "@/lib/email/mailbox-provider";

describe("mailbox state machine", () => {
  const legal: [MailboxStatus, MailboxStatus][] = [
    ["pending_approval", "active"], ["active", "paused"], ["active", "reconnect_required"], ["active", "disconnected"], ["active", "error"],
    ["paused", "active"], ["paused", "reconnect_required"], ["paused", "disconnected"], ["reconnect_required", "active"], ["reconnect_required", "disconnected"],
    ["error", "active"], ["error", "paused"], ["error", "reconnect_required"], ["error", "disconnected"], ["disconnected", "active"],
  ];
  it.each(legal)("%s → %s is allowed", (from, to) => expect(canTransitionMailbox(from, to)).toBe(true));

  it("everything not listed is illegal", () => {
    const all = MAILBOX_STATUSES.flatMap((f) => MAILBOX_STATUSES.map((t) => [f, t] as const));
    const illegal = all.filter(([f, t]) => !legal.some(([lf, lt]) => lf === f && lt === t));
    expect(illegal.length).toBeGreaterThan(20);
    for (const [f, t] of illegal) expect(canTransitionMailbox(f, t), `${f} → ${t}`).toBe(false);
  });

  it("a disconnected mailbox can only come back through reconnecting; an unapproved one can't skip approval into paused", () => {
    expect(MAILBOX_TRANSITIONS.disconnected).toEqual(["active"]);
    expect(canTransitionMailbox("pending_approval", "paused")).toBe(false);
  });
});

describe("mailboxBlockedReason", () => {
  it("only a connected mailbox sends; a Resend one also needs its domain verified", () => {
    expect(mailboxBlockedReason({ provider: "gmail", status: "active" })).toBeNull();
    expect(mailboxBlockedReason({ provider: "microsoft", status: "active", domainStatus: null })).toBeNull();
    expect(mailboxBlockedReason({ provider: "resend", status: "active", domainStatus: "verified" })).toBeNull();
    expect(mailboxBlockedReason({ provider: "resend", status: "active", domainStatus: "pending" })).toMatch(/domain/);
    expect(mailboxBlockedReason({ provider: "gmail", status: "reconnect_required" })).toBe("Your mailbox needs to be reconnected before LeadGennie can continue sending.");
    for (const status of ["paused", "disconnected", "error", "pending_approval"] as const) expect(isSendable({ provider: "gmail", status })).toBe(false);
  });
  it("classifies providers by how you connect them, not by name", () => {
    expect([isOAuthProvider("gmail"), isOAuthProvider("microsoft"), isOAuthProvider("resend"), isOAuthProvider("smtp")]).toEqual([true, true, false, false]);
  });
});

describe("scopes", () => {
  it("asks for identity + send only — reading mail is opt-in", () => {
    expect(scopesFor("gmail")).toEqual(["openid", "email", "profile", GMAIL_SEND_SCOPE]);
    expect(scopesFor("gmail")).not.toContain(GMAIL_READ_SCOPE);
    expect(scopesFor("microsoft")).toEqual(expect.arrayContaining(["offline_access", "User.Read", "Mail.Send"]));
    expect(scopesFor("microsoft")).not.toContain("Mail.Read");
    expect(scopesFor("gmail", ["send", "inbox"])).toContain(GMAIL_READ_SCOPE);
  });
  it("checks what was GRANTED (granular consent lets the user untick send)", () => {
    expect(missingScopes("gmail", ["openid", "email"])).toEqual(requiredScopes("gmail"));
    expect(missingScopes("gmail", [GMAIL_SEND_SCOPE])).toEqual([]);
    expect(hasScope(["https://graph.microsoft.com/Mail.Send", "User.Read"], "Mail.Send")).toBe(true); // Graph qualifies scopes with the resource
    expect(hasScope(["mail.send"], "Mail.Send")).toBe(true);
    expect(canReadMailbox("gmail", [GMAIL_SEND_SCOPE])).toBe(false);
    expect(canReadMailbox("gmail", [GMAIL_SEND_SCOPE, GMAIL_READ_SCOPE])).toBe(true);
  });
});

describe("connect error messages", () => {
  it("every code has a sentence, names the provider, and never leaks raw provider text", () => {
    for (const code of CONNECT_ERROR_CODES) {
      const msg = connectErrorMessage(code, "gmail");
      expect(msg.length).toBeGreaterThan(20);
      expect(msg).not.toMatch(/AADSTS|invalid_grant|stack|token/i);
    }
    expect(connectErrorMessage("exchange_failed", "gmail")).toBe("Google authorization failed. Please try connecting your Google account again.");
  });
});

const msg = (over: Partial<EmailMessage> = {}): EmailMessage => ({
  mailboxId: 1, providerMessageId: "m1", providerThreadId: "t1", direction: "in", from: { email: "lead@x.io", name: null }, to: [], cc: [], subject: "Re: hi", text: "sure",
  sentAt: null, receivedAt: new Date(), rfcMessageId: "<r1@x>", inReplyTo: null, references: [], headers: {}, ...over,
});
const sent = { rfcMessageIds: new Set(["<sent1@lg>"]), threadIds: new Set(["t-sent"]) };

describe("reply detection", () => {
  it("matches In-Reply-To, then References, then the provider thread", () => {
    expect(matchReply(msg({ inReplyTo: "<SENT1@lg>" }), sent)).toMatchObject({ isReply: true, via: "in_reply_to" }); // case/brackets don't matter
    expect(matchReply(msg({ references: ["<old@x>", "sent1@lg"] }), sent)).toMatchObject({ isReply: true, via: "references" });
    expect(matchReply(msg({ providerThreadId: "t-sent" }), sent)).toMatchObject({ isReply: true, via: "thread" });
  });
  it("is not a reply when nothing links it to what we sent, or when it is our own message", () => {
    expect(matchReply(msg(), sent).isReply).toBe(false);
    expect(matchReply(msg({ direction: "out", providerThreadId: "t-sent" }), sent).isReply).toBe(false);
  });
  it("flags out-of-office and machine replies without dropping them", () => {
    expect(matchReply(msg({ providerThreadId: "t-sent", headers: { "auto-submitted": "auto-replied" } }), sent)).toMatchObject({ isReply: true, autoReply: true });
    expect(isAutoReply(msg({ subject: "Automatic reply: Out of office" }))).toBe(true);
    expect(isAutoReply(msg({ headers: { precedence: "bulk" } }))).toBe(true);
    expect(isAutoReply(msg({ headers: { "auto-submitted": "no" } }))).toBe(false);
    expect(isAutoReply(msg())).toBe(false);
  });
});
