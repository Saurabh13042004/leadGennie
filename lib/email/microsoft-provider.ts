import { authorizedFetch, readJson, retryAfterSeconds, type FetchLike } from "./http";
import { GRAPH_MESSAGE_SELECT, normalizeGraphMessage, type GraphMessage } from "./graph-messages";
import { buildMime } from "./mime";
import type { AccessTokenSource, EmailThread, ListMessagesInput, MailboxMessagePage, MailboxProfile, MailboxProvider, MailboxRef } from "./mailbox-provider";
import { MailProviderError, type MailCapabilities, type MailSendInput, type MailSendResult, type ProviderErrorClass } from "./provider";
import { GRAPH_READ_SCOPE, hasScope } from "@/lib/domain/mailboxes/scopes";

const GRAPH = "https://graph.microsoft.com/v1.0";
const TEXT_BODY = { Prefer: 'outlook.body-content-type="text"' };

type GraphError = { error?: { code?: string; message?: string } };

/**
 * Maps a Graph failure onto our classes. Like Gmail, Graph has no idempotency key, so a 5xx/timeout on a SEND is
 * `unknown_outcome` — `sendMail` is asynchronous (it answers 202), and a gateway error doesn't tell us whether it was queued.
 */
export function classifyGraphError(status: number, body: unknown, retryAfter?: number): { cls: ProviderErrorClass; code: string; retryAfterSeconds?: number } {
  const code = (body as GraphError | null)?.error?.code ?? "";
  if (status === 401) return { cls: "auth", code: code || "unauthenticated" };
  if (status === 429) return { cls: "rate_limited", code: code || "throttled", retryAfterSeconds: retryAfter ?? 60 };
  if (/quota/i.test(code)) return { cls: "quota", code, retryAfterSeconds: retryAfter ?? 3600 };
  // The account has no Exchange Online mailbox (or it's disabled / not REST-enabled): sending can't work until that's fixed.
  if (/MailboxNotEnabledForRESTAPI|MailboxNotSupportedForRESTAPI|MailboxNotFound|ResourceNotFound|InactiveMailbox/i.test(code) || (status === 404 && !code)) return { cls: "domain", code: code || "no_mailbox" };
  if (status === 403) return { cls: "auth", code: code || "forbidden" };
  if (status >= 500 || status === 408) return { cls: "unknown_outcome", code: code || `http_${status}` };
  return { cls: "permanent", code: code || `http_${status}` };
}

function failure(status: number, body: unknown, retryAfter?: number, mutating = true): MailProviderError {
  const c = classifyGraphError(status, body, retryAfter);
  const message = (body as GraphError | null)?.error?.message ?? `Microsoft Graph returned HTTP ${status}`;
  return new MailProviderError(message, !mutating && c.cls === "unknown_outcome" ? "retryable" : c.cls, c.code, c.retryAfterSeconds);
}

export class MicrosoftMailboxProvider implements MailboxProvider {
  readonly name = "microsoft";
  readonly capabilities: MailCapabilities;

  constructor(
    private readonly mailbox: MailboxRef,
    private readonly tokens: AccessTokenSource,
    private readonly fetchImpl: FetchLike = fetch,
    private readonly configured: () => boolean = () => true,
  ) {
    // `sendMail` returns no message or conversation id, so sends aren't threaded until the inbox scope lets us read Sent Items.
    this.capabilities = { idempotencyKey: false, oneClickUnsubscribeHeaders: true, threading: false, inboxSync: hasScope(mailbox.scopes, GRAPH_READ_SCOPE) };
  }

  isConfigured() {
    return this.configured();
  }

  async getProfile(): Promise<MailboxProfile> {
    const body = await this.getJson<{ id?: string; displayName?: string | null; mail?: string | null; userPrincipalName?: string }>(`${GRAPH}/me?$select=id,displayName,mail,userPrincipalName`);
    const email = (body.mail || body.userPrincipalName || "").toLowerCase();
    if (!body.id || !email.includes("@")) throw new MailProviderError("Microsoft didn't return an account identity", "permanent", "no_identity");
    // Microsoft only puts an address in `mail` once the tenant has provisioned the mailbox for it: that is the proof of control we need.
    return { providerAccountId: body.id, email, displayName: body.displayName ?? null, emailVerified: Boolean(body.mail) };
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    // MIME rather than the JSON message shape: Graph's JSON form only accepts `x-` custom headers, which would drop List-Unsubscribe.
    const mime = buildMime({
      from: { email: input.from, name: this.mailbox.displayName }, to: [input.to], cc: input.cc, bcc: input.bcc, replyTo: input.replyTo,
      subject: input.subject, text: input.text, html: input.html, headers: input.headers, inReplyTo: input.inReplyTo, references: input.references,
    });
    const res = await authorizedFetch(
      this.tokens, this.fetchImpl, `${GRAPH}/me/sendMail`,
      { method: "POST", headers: { "Content-Type": "text/plain" }, body: Buffer.from(mime, "utf8").toString("base64") },
      { mutating: true },
    );
    if (!res.ok) throw failure(res.status, await readJson(res), retryAfterSeconds(res));
    // 202 Accepted, empty body: the email is on its way but Graph doesn't name it — we honestly record "no id" rather than invent one.
    return { id: null, threadId: null };
  }

  async listMessages(input: ListMessagesInput): Promise<MailboxMessagePage> {
    this.requireInboxScope();
    const url = input.cursor ? this.trustedUrl(input.cursor) : `${GRAPH}/me/mailFolders/inbox/messages?${new URLSearchParams({
      $top: String(Math.min(input.limit ?? 25, 100)), $orderby: "receivedDateTime asc", $select: GRAPH_MESSAGE_SELECT,
      ...(input.since ? { $filter: `receivedDateTime ge ${input.since.toISOString()}` } : {}),
    })}`;
    const page = await this.getJson<{ value?: GraphMessage[]; "@odata.nextLink"?: string }>(url, TEXT_BODY);
    return { messages: (page.value ?? []).map((m) => normalizeGraphMessage(m, { id: this.mailbox.mailboxId, email: this.mailbox.email })), nextCursor: page["@odata.nextLink"] ?? null };
  }

  async getThread(providerThreadId: string): Promise<EmailThread> {
    this.requireInboxScope();
    const filter = `conversationId eq '${providerThreadId.replace(/'/g, "''")}'`;
    const page = await this.getJson<{ value?: GraphMessage[] }>(`${GRAPH}/me/messages?${new URLSearchParams({ $filter: filter, $select: GRAPH_MESSAGE_SELECT, $top: "50" })}`, TEXT_BODY);
    const messages = (page.value ?? []).map((m) => normalizeGraphMessage(m, { id: this.mailbox.mailboxId, email: this.mailbox.email }));
    messages.sort((a, b) => ((a.sentAt ?? a.receivedAt)?.getTime() ?? 0) - ((b.sentAt ?? b.receivedAt)?.getTime() ?? 0));
    return { providerThreadId, messages };
  }

  private requireInboxScope() {
    if (!this.capabilities.inboxSync) throw new MailProviderError("This mailbox was connected without permission to read mail. Reconnect it to enable the inbox.", "auth", "missing_read_scope");
  }

  /** A paging cursor is a URL we get back from Graph and later send a bearer token to: never follow one that points elsewhere. */
  private trustedUrl(cursor: string): string {
    if (!cursor.startsWith(`${GRAPH}/`)) throw new MailProviderError("Unexpected paging cursor", "permanent", "bad_cursor");
    return cursor;
  }

  private async getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
    const res = await authorizedFetch(this.tokens, this.fetchImpl, url, { method: "GET", headers }, { mutating: false });
    const body = await readJson(res);
    if (!res.ok) throw failure(res.status, body, retryAfterSeconds(res), false);
    return body as T;
  }
}
