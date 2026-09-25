import type { EmailAddress, EmailMessage } from "./mailbox-provider";

/**
 * Gmail API message → `EmailMessage`. Pure: takes the JSON `users.messages.get(format=full)` returns, gives our shape.
 * Everything Gmail-specific (label ids, base64url body parts, `internalDate` in ms) ends here.
 */

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; headers?: GmailHeader[]; body?: { data?: string; size?: number }; parts?: GmailPart[] };
export type GmailMessage = {
  id: string;
  threadId?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: GmailPart;
};

/** The only headers kept: what reply detection and auto-responder filtering need. */
const KEEP_HEADERS = ["auto-submitted", "x-autoreply", "x-autorespond", "precedence", "list-id", "list-unsubscribe", "return-path"];

/** `"Ada Lovelace" <ada@x.com>, bob@y.com` → addresses. Tolerates quoted commas; drops anything without an `@`. */
export function parseAddressList(value: string | undefined): EmailAddress[] {
  if (!value) return [];
  const out: EmailAddress[] = [];
  let depthQuote = false;
  let angle = false;
  let cur = "";
  const flush = () => {
    const part = cur.trim();
    cur = "";
    if (!part) return;
    const m = /^(.*?)<([^<>]+)>\s*$/.exec(part);
    const email = (m ? m[2] : part).trim().toLowerCase();
    if (!email.includes("@")) return;
    const name = m ? m[1].trim().replace(/^"(.*)"$/, "$1").replace(/\\(.)/g, "$1").trim() : "";
    out.push({ email, name: name || null });
  };
  for (const ch of value) {
    if (ch === '"') depthQuote = !depthQuote;
    else if (!depthQuote && ch === "<") angle = true;
    else if (!depthQuote && ch === ">") angle = false;
    if (ch === "," && !depthQuote && !angle) flush();
    else cur += ch;
  }
  flush();
  return out;
}

const decode = (data: string | undefined) => (data ? Buffer.from(data, "base64url").toString("utf8") : "");

/** Crude but safe HTML → text for mail that has no text/plain alternative. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function findBody(part: GmailPart | undefined, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const found = findBody(p, mime);
    if (found !== null) return found;
  }
  return null;
}

export function bodyText(payload: GmailPart | undefined): string {
  const plain = findBody(payload, "text/plain");
  if (plain !== null) return plain.trim();
  const html = findBody(payload, "text/html");
  return html !== null ? htmlToText(html) : "";
}

export function normalizeGmailMessage(raw: GmailMessage, mailbox: { id: number; email: string }): EmailMessage {
  const headers = new Map((raw.payload?.headers ?? []).map((h) => [h.name.toLowerCase(), h.value]));
  const from = parseAddressList(headers.get("from"))[0] ?? null;
  const outgoing = from?.email === mailbox.email.toLowerCase() || (raw.labelIds ?? []).includes("SENT");
  const at = raw.internalDate ? new Date(Number(raw.internalDate)) : headers.get("date") ? new Date(headers.get("date")!) : null;
  const when = at && !Number.isNaN(at.getTime()) ? at : null;
  return {
    mailboxId: mailbox.id,
    providerMessageId: raw.id,
    providerThreadId: raw.threadId ?? null,
    direction: outgoing ? "out" : "in",
    from,
    to: parseAddressList(headers.get("to")),
    cc: parseAddressList(headers.get("cc")),
    subject: headers.get("subject") ?? "",
    text: bodyText(raw.payload),
    sentAt: outgoing ? when : null,
    receivedAt: outgoing ? null : when,
    rfcMessageId: headers.get("message-id")?.trim() || null,
    inReplyTo: headers.get("in-reply-to")?.trim() || null,
    references: (headers.get("references") ?? "").split(/\s+/).filter(Boolean),
    headers: Object.fromEntries(KEEP_HEADERS.flatMap((k) => (headers.has(k) ? [[k, headers.get(k)!]] : []))),
  };
}
