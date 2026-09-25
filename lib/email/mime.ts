import { randomBytes } from "node:crypto";

/**
 * Builds an RFC 5322 / MIME message. Gmail (`messages.send` raw) and Microsoft Graph (`sendMail` in MIME format) both take
 * a finished message, so this is the one place that turns our `MailSendInput` into bytes.
 *
 * Header injection is the risk that matters here: subject, names and addresses come from lead data. Every header value is
 * rejected if it contains CR/LF instead of being "cleaned", because a silently rewritten address is a wrong recipient.
 */

export type MimeInput = {
  from: { email: string; name?: string | null };
  to: string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  html?: string;
  headers?: Record<string, string>;
  inReplyTo?: string;
  references?: string[];
  date?: Date;
};

export class MimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MimeError";
  }
}

const CRLF = "\r\n";
const ADDRESS = /^[^\s<>",;()[\]\\]+@[^\s<>",;()[\]\\]+$/;
const HEADER_NAME = /^[A-Za-z0-9-]+$/;
/** Headers this module writes itself: a caller-supplied duplicate would produce two From/To lines. */
const RESERVED = new Set(["from", "to", "cc", "bcc", "reply-to", "subject", "date", "mime-version", "content-type", "content-transfer-encoding", "message-id", "in-reply-to", "references"]);

function noLineBreaks(value: string, what: string): string {
  if (/[\r\n\0]/.test(value)) throw new MimeError(`${what} contains a line break`);
  return value;
}

export function assertAddress(email: string): string {
  const v = noLineBreaks(email.trim(), "Email address");
  if (!ADDRESS.test(v)) throw new MimeError(`"${v.slice(0, 80)}" is not a valid email address`);
  return v;
}

const isAscii = (s: string) => /^[\x20-\x7e]*$/.test(s);

/** RFC 2047 encoded-word(s), split on code-point boundaries so a multi-byte character is never cut in half. */
export function encodeWords(value: string): string {
  if (isAscii(value)) return value;
  const words: string[] = [];
  let chunk = "";
  for (const ch of value) {
    if (Buffer.byteLength(chunk + ch, "utf8") > 42) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => `=?UTF-8?B?${Buffer.from(w, "utf8").toString("base64")}?=`).join(`${CRLF} `);
}

function mailbox(email: string, name?: string | null): string {
  const addr = assertAddress(email);
  const n = name?.trim();
  if (!n) return addr;
  noLineBreaks(n, "Display name");
  const shown = isAscii(n) ? `"${n.replace(/(["\\])/g, "\\$1")}"` : encodeWords(n);
  return `${shown} <${addr}>`;
}

const base64Lines = (s: string) => (Buffer.from(s, "utf8").toString("base64").match(/.{1,76}/g) ?? [""]).join(CRLF);

function textPart(contentType: string, body: string): string {
  return [`Content-Type: ${contentType}; charset=UTF-8`, "Content-Transfer-Encoding: base64", "", base64Lines(body)].join(CRLF);
}

export function buildMime(input: MimeInput): string {
  const lines: string[] = [];
  const push = (name: string, value: string) => lines.push(`${name}: ${value}`);

  push("Date", (input.date ?? new Date()).toUTCString());
  push("From", mailbox(input.from.email, input.from.name));
  if (input.to.length === 0) throw new MimeError("A message needs at least one recipient");
  push("To", input.to.map((a) => mailbox(a)).join(", "));
  if (input.cc?.length) push("Cc", input.cc.map((a) => mailbox(a)).join(", "));
  if (input.bcc?.length) push("Bcc", input.bcc.map((a) => mailbox(a)).join(", "));
  if (input.replyTo) push("Reply-To", mailbox(input.replyTo));
  push("Subject", encodeWords(noLineBreaks(input.subject, "Subject")));
  if (input.inReplyTo) push("In-Reply-To", noLineBreaks(input.inReplyTo, "In-Reply-To"));
  if (input.references?.length) push("References", input.references.map((r) => noLineBreaks(r, "References")).join(" "));
  for (const [name, value] of Object.entries(input.headers ?? {})) {
    if (!HEADER_NAME.test(name)) throw new MimeError(`"${name.slice(0, 40)}" is not a valid header name`);
    if (RESERVED.has(name.toLowerCase())) throw new MimeError(`The ${name} header is set by the sender, not passed through`);
    push(name, noLineBreaks(value, `Header ${name}`));
  }
  push("MIME-Version", "1.0");

  if (!input.html) return [...lines, textPart("text/plain", input.text), ""].join(CRLF);

  const boundary = `lg_${randomBytes(12).toString("hex")}`;
  push("Content-Type", `multipart/alternative; boundary="${boundary}"`);
  return [
    ...lines, "",
    `--${boundary}`, textPart("text/plain", input.text),
    `--${boundary}`, textPart("text/html", input.html),
    `--${boundary}--`, "",
  ].join(CRLF);
}

/** base64url, as the Gmail API's `raw` field wants it. */
export const toBase64Url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
