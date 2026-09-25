import type { EmailMessage } from "@/lib/email/mailbox-provider";

/**
 * Reply detection over normalised messages — provider-independent, because Gmail and Graph messages have already been reduced
 * to `EmailMessage`. Pure: the caller (the Inbox sync) supplies what LeadGennie has sent.
 *
 * Matching prefers the strongest evidence: `In-Reply-To` names the exact message being answered; `References` names the chain;
 * a shared provider thread is the fallback (mail clients that drop the headers still stay in the provider's thread).
 */

export type SentIndex = {
  /** `Message-ID`s of emails LeadGennie sent (angle brackets optional). */
  rfcMessageIds: ReadonlySet<string>;
  /** Provider thread ids of emails LeadGennie sent. */
  threadIds: ReadonlySet<string>;
};

export type ReplyMatch = { isReply: boolean; via: "in_reply_to" | "references" | "thread" | null; autoReply: boolean };

const norm = (id: string) => id.trim().replace(/^<|>$/g, "").toLowerCase();

/** Out-of-office and other machine-generated answers: they arrive as replies but are not a person answering. */
export function isAutoReply(m: EmailMessage): boolean {
  const h = m.headers;
  const auto = h["auto-submitted"]?.toLowerCase();
  if (auto && auto !== "no") return true;
  if (h["x-autoreply"] || h["x-autorespond"]) return true;
  if (/^(bulk|junk|auto_reply)$/i.test(h["precedence"] ?? "")) return true;
  return /^(automatic reply|auto(matic)?[- ]?reply|out of office)\b/i.test(m.subject.trim());
}

export function matchReply(m: EmailMessage, sent: SentIndex): ReplyMatch {
  const none: ReplyMatch = { isReply: false, via: null, autoReply: false };
  if (m.direction !== "in") return none; // our own message is never a reply to us
  const ids = new Set([...sent.rfcMessageIds].map(norm));
  const via = m.inReplyTo && ids.has(norm(m.inReplyTo)) ? "in_reply_to"
    : m.references.some((r) => ids.has(norm(r))) ? "references"
    : m.providerThreadId && sent.threadIds.has(m.providerThreadId) ? "thread"
    : null;
  return via ? { isReply: true, via, autoReply: isAutoReply(m) } : none;
}
