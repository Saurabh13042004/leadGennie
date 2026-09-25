import { htmlToText } from "./gmail-messages";
import type { EmailAddress, EmailMessage } from "./mailbox-provider";

/**
 * Microsoft Graph message → `EmailMessage`. Pure. Graph calls the thread a `conversationId` and hands headers back as
 * `internetMessageHeaders` (only when asked); both are normalised here so nothing downstream knows the difference from Gmail.
 */

type GraphRecipient = { emailAddress?: { name?: string; address?: string } };
export type GraphMessage = {
  id: string;
  conversationId?: string;
  subject?: string | null;
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  sentDateTime?: string;
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
  internetMessageId?: string;
  internetMessageHeaders?: { name: string; value: string }[];
};

/** Fields to `$select`: exactly what `normalizeGraphMessage` reads, nothing more. */
export const GRAPH_MESSAGE_SELECT =
  "id,conversationId,subject,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,body,internetMessageId,internetMessageHeaders";

const KEEP_HEADERS = ["auto-submitted", "x-autoreply", "x-autorespond", "precedence", "list-id", "list-unsubscribe", "return-path"];

const address = (r: GraphRecipient | undefined): EmailAddress | null => {
  const email = r?.emailAddress?.address?.trim().toLowerCase();
  return email ? { email, name: r?.emailAddress?.name?.trim() || null } : null;
};
const addresses = (rs: GraphRecipient[] | undefined) => (rs ?? []).map(address).filter((a): a is EmailAddress => a !== null);
const date = (v: string | undefined) => {
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

export function normalizeGraphMessage(raw: GraphMessage, mailbox: { id: number; email: string }): EmailMessage {
  const headers = new Map((raw.internetMessageHeaders ?? []).map((h) => [h.name.toLowerCase(), h.value]));
  const from = address(raw.from);
  const outgoing = from?.email === mailbox.email.toLowerCase();
  const content = raw.body?.content ?? "";
  return {
    mailboxId: mailbox.id,
    providerMessageId: raw.id,
    providerThreadId: raw.conversationId ?? null,
    direction: outgoing ? "out" : "in",
    from,
    to: addresses(raw.toRecipients),
    cc: addresses(raw.ccRecipients),
    subject: raw.subject ?? "",
    text: (raw.body?.contentType ?? "").toLowerCase() === "html" ? htmlToText(content) : content.trim(),
    sentAt: outgoing ? date(raw.sentDateTime) : null,
    receivedAt: outgoing ? null : date(raw.receivedDateTime),
    rfcMessageId: raw.internetMessageId?.trim() || null,
    inReplyTo: headers.get("in-reply-to")?.trim() || null,
    references: (headers.get("references") ?? "").split(/\s+/).filter(Boolean),
    headers: Object.fromEntries(KEEP_HEADERS.flatMap((k) => (headers.has(k) ? [[k, headers.get(k)!]] : []))),
  };
}
