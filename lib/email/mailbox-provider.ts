import type { MailProvider } from "./provider";

/**
 * The mailbox-shaped extension of the send port. Campaigns, sequences, the inbox and agents talk to a mailbox through this
 * (resolved per mailbox by lib/domain/mailboxes/registry.ts) and never to Gmail / Microsoft Graph / Resend directly.
 *
 * Interface segregation: only `getProfile` is mandatory. Reading the mailbox is optional, advertised by
 * `capabilities.inboxSync` — callers check the flag, they don't branch on a name. Revoking access is not here: it needs the
 * refresh token, which only the OAuth client (lib/domain/mailboxes/oauth) ever holds.
 */

export type EmailAddress = { email: string; name: string | null };

/**
 * Our own shape for a message in a mailbox. Gmail's `payload.parts` and Graph's `toRecipients` stop at the adapter:
 * nothing outside lib/email/* ever sees a provider's raw format.
 */
export type EmailMessage = {
  mailboxId: number;
  /** Gmail message id / Graph message id. */
  providerMessageId: string;
  /** Gmail `threadId` / Graph `conversationId` — different things, one field; only ever compared within one mailbox. */
  providerThreadId: string | null;
  direction: "in" | "out";
  from: EmailAddress | null;
  to: EmailAddress[];
  cc: EmailAddress[];
  subject: string;
  /** Plain text. HTML-only mail is converted, so `text` is always readable. */
  text: string;
  sentAt: Date | null;
  receivedAt: Date | null;
  /** RFC 5322 `Message-ID`, `In-Reply-To` and `References` — what reply detection matches on. */
  rfcMessageId: string | null;
  inReplyTo: string | null;
  references: string[];
  /** A small, lower-cased allow-list of headers (auto-reply and unsubscribe signals) — not the whole header block. */
  headers: Record<string, string>;
};

export type EmailThread = { providerThreadId: string; messages: EmailMessage[] };

export type MailboxProfile = {
  /** The provider's stable id for the account (Google `sub`, Microsoft object id). */
  providerAccountId: string;
  email: string;
  displayName: string | null;
  /** The provider vouches that the user controls this address. Connecting requires it. */
  emailVerified: boolean;
};

export type ListMessagesInput = { since?: Date; cursor?: string | null; limit?: number };
export type MailboxMessagePage = { messages: EmailMessage[]; nextCursor: string | null };

export interface MailboxProvider extends MailProvider {
  /** Who this mailbox belongs to, as the provider says. Throws `MailProviderError` (auth ⇒ the connection needs renewing). */
  getProfile(): Promise<MailboxProfile>;
  /** Present when `capabilities.inboxSync`. */
  listMessages?(input: ListMessagesInput): Promise<MailboxMessagePage>;
  /** Present when `capabilities.inboxSync`. */
  getThread?(providerThreadId: string): Promise<EmailThread>;
}

/**
 * Where an adapter gets a bearer token. The adapter never sees a refresh token or the database: it asks for a token, and if
 * the provider answers 401 it asks for a fresh one exactly once. (Dependency inversion — tests pass a plain object.)
 */
export interface AccessTokenSource {
  getAccessToken(): Promise<string>;
  /** Force a refresh (the provider rejected the current token). Throws `MailProviderError("auth")` when the grant is gone. */
  refresh(): Promise<string>;
}

/** Identifies the mailbox an adapter serves. Everything here is safe to log. */
export type MailboxRef = {
  workspaceId: number;
  mailboxId: number;
  email: string;
  displayName: string | null;
  /** OAuth scopes granted for this connection — decides `capabilities.inboxSync`. */
  scopes: string[];
};
