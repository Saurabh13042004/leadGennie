import { authorizedFetch, readJson, retryAfterSeconds, type FetchLike } from "./http";
import { normalizeGmailMessage, type GmailMessage } from "./gmail-messages";
import { buildMime, toBase64Url } from "./mime";
import type { AccessTokenSource, EmailThread, ListMessagesInput, MailboxMessagePage, MailboxProfile, MailboxProvider, MailboxRef } from "./mailbox-provider";
import { MailProviderError, type MailCapabilities, type MailSendInput, type MailSendResult, type ProviderErrorClass } from "./provider";
import { GMAIL_READ_SCOPE, hasScope } from "@/lib/domain/mailboxes/scopes";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";
const USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";

type GmailError = { error?: { code?: number; message?: string; status?: string; errors?: { reason?: string }[] } };

/**
 * Maps a Gmail API failure onto our classes. Gmail has no idempotency key, so on a SEND every failure that isn't a clear
 * pre-acceptance rejection (401/403/429/4xx) is `unknown_outcome`: a 5xx or timeout may have queued the email, and resending
 * could deliver it twice. A missed email over a duplicate.
 */
export function classifyGmailError(status: number, body: unknown, retryAfter?: number): { cls: ProviderErrorClass; code: string; retryAfterSeconds?: number } {
  const e = (body as GmailError | null)?.error;
  const reason = (e?.errors?.[0]?.reason ?? e?.status ?? "").toString();
  const msg = (e?.message ?? "").toLowerCase();
  if (status === 401) return { cls: "auth", code: "unauthenticated" };
  if (status === 429 || (status === 403 && /ratelimit|quota|limit/i.test(reason + msg))) {
    return /daily|quota/i.test(reason + msg) ? { cls: "quota", code: reason || "quota", retryAfterSeconds: retryAfter ?? 3600 } : { cls: "rate_limited", code: reason || "rate_limited", retryAfterSeconds: retryAfter ?? 60 };
  }
  // The Gmail API isn't enabled for our Google Cloud project, or the account can't use Gmail: no email from this mailbox will work.
  if (reason === "accessNotConfigured" || reason === "failedPrecondition" || /gmail api has not been used|service not enabled|mail service not enabled/.test(msg)) return { cls: "domain", code: reason || "not_enabled" };
  if (status === 403 || status === 404) return { cls: "auth", code: reason || "forbidden" };
  if (status >= 500 || status === 408) return { cls: "unknown_outcome", code: reason || `http_${status}` };
  return { cls: "permanent", code: reason || `http_${status}` };
}

function failure(status: number, body: unknown, retryAfter?: number, mutating = true): MailProviderError {
  const c = classifyGmailError(status, body, retryAfter);
  const message = (body as GmailError | null)?.error?.message ?? `Gmail returned HTTP ${status}`;
  // Reads have nothing to duplicate: an ambiguous 5xx is just a retry.
  return new MailProviderError(message, !mutating && c.cls === "unknown_outcome" ? "retryable" : c.cls, c.code, c.retryAfterSeconds);
}

export class GmailMailboxProvider implements MailboxProvider {
  readonly name = "gmail";
  readonly capabilities: MailCapabilities;

  constructor(
    private readonly mailbox: MailboxRef,
    private readonly tokens: AccessTokenSource,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly configured: () => boolean = () => true,
  ) {
    this.capabilities = {
      idempotencyKey: false, oneClickUnsubscribeHeaders: true, threading: true, inboxSync: hasScope(mailbox.scopes, GMAIL_READ_SCOPE),
    };
  }

  isConfigured() {
    return this.configured();
  }

  async getProfile(): Promise<MailboxProfile> {
    const res = await authorizedFetch(this.tokens, this.fetchImpl, USERINFO, { method: "GET" }, { mutating: false });
    const body = (await readJson(res)) as { sub?: string; email?: string; email_verified?: boolean; name?: string } | null;
    if (!res.ok) throw failure(res.status, body, retryAfterSeconds(res), false);
    if (!body?.sub || !body.email) throw new MailProviderError("Google didn't return an account identity", "permanent", "no_identity");
    return { providerAccountId: body.sub, email: body.email.toLowerCase(), displayName: body.name ?? null, emailVerified: body.email_verified === true };
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    const raw = toBase64Url(
      buildMime({
        from: { email: input.from, name: this.mailbox.displayName }, to: [input.to], cc: input.cc, bcc: input.bcc, replyTo: input.replyTo,
        subject: input.subject, text: input.text, html: input.html, headers: input.headers, inReplyTo: input.inReplyTo, references: input.references,
      }),
    );
    const res = await authorizedFetch(
      this.tokens, this.fetchImpl, `${API}/messages/send`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }) },
      { mutating: true },
    );
    const body = (await readJson(res)) as { id?: string; threadId?: string } & GmailError | null;
    if (!res.ok) throw failure(res.status, body, retryAfterSeconds(res));
    // A 2xx with no id is still an accepted email — never claim it failed (a retry would duplicate it).
    return { id: body?.id ?? null, threadId: body?.threadId ?? null };
  }

  async listMessages(input: ListMessagesInput): Promise<MailboxMessagePage> {
    this.requireInboxScope();
    const q = new URLSearchParams({ maxResults: String(Math.min(input.limit ?? 25, 100)), q: `in:inbox${input.since ? ` after:${Math.floor(input.since.getTime() / 1000)}` : ""}` });
    if (input.cursor) q.set("pageToken", input.cursor);
    const list = await this.getJson<{ messages?: { id: string }[]; nextPageToken?: string }>(`${API}/messages?${q}`);
    const messages = await Promise.all((list.messages ?? []).map((m) => this.getJson<GmailMessage>(`${API}/messages/${encodeURIComponent(m.id)}?format=full`)));
    return { messages: messages.map((m) => normalizeGmailMessage(m, { id: this.mailbox.mailboxId, email: this.mailbox.email })), nextCursor: list.nextPageToken ?? null };
  }

  async getThread(providerThreadId: string): Promise<EmailThread> {
    this.requireInboxScope();
    const t = await this.getJson<{ id: string; messages?: GmailMessage[] }>(`${API}/threads/${encodeURIComponent(providerThreadId)}?format=full`);
    return { providerThreadId: t.id, messages: (t.messages ?? []).map((m) => normalizeGmailMessage(m, { id: this.mailbox.mailboxId, email: this.mailbox.email })) };
  }

  private requireInboxScope() {
    if (!this.capabilities.inboxSync) throw new MailProviderError("This mailbox was connected without permission to read mail. Reconnect it to enable the inbox.", "auth", "missing_read_scope");
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await authorizedFetch(this.tokens, this.fetchImpl, url, { method: "GET" }, { mutating: false });
    const body = await readJson(res);
    if (!res.ok) throw failure(res.status, body, retryAfterSeconds(res), false);
    return body as T;
  }
}
