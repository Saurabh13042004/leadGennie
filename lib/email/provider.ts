/**
 * Outbound mail provider port. Everything that sends email depends on this interface, never on a vendor SDK, so Resend,
 * Gmail and Microsoft Graph are interchangeable (D-04) and tests can use a fake with the same contract (Liskov).
 * The mailbox-specific extension (profile, reading a mailbox) is `MailboxProvider` in ./mailbox-provider.ts.
 */

export type MailSendInput = {
  from: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  subject: string;
  text: string;
  /** Optional HTML alternative (transactional mail); `text` stays the plain-text part and is always required. */
  html?: string;
  headers?: Record<string, string>;
  /**
   * Replaying the same key with the same payload must NOT send a second email — for providers whose
   * `capabilities.idempotencyKey` is true. Providers without it (Gmail, Microsoft) ignore the key; the sending pipeline
   * then guarantees at-most-once itself (write-ahead `dispatched_at`, see lib/domain/sending/handler.ts).
   */
  idempotencyKey: string;
  tags?: { name: string; value: string }[];
  /** Continue an existing conversation: the provider's own thread id plus the RFC 5322 ids being replied to (Gmail, Microsoft). */
  threadId?: string;
  inReplyTo?: string;
  references?: string[];
};

/** `id` is null when the provider accepted the email but doesn't say what it is called (Microsoft Graph `sendMail` answers 202 with no body). */
export type MailSendResult = { id: string | null; threadId?: string | null };

/**
 * What kind of failure this was — decides the response:
 *  retryable / rate_limited / quota : try again later (backoff)
 *  permanent                        : this email can never be sent (bad recipient, rejected content) — fail it, don't retry
 *  auth / domain                    : the whole sending setup is broken (bad key, unverified domain, mailbox needs reconnecting) — pause the campaign
 *  unknown_outcome                  : the request may or may not have been accepted (connection lost mid-send, 5xx) AND the provider has no
 *                                     idempotency key, so retrying could send a duplicate — flag it for a person instead
 *
 * Contract for providers without an idempotency key: every class EXCEPT `unknown_outcome` means "nothing was sent".
 */
export type ProviderErrorClass = "retryable" | "rate_limited" | "quota" | "permanent" | "auth" | "domain" | "unknown_outcome";

export class MailProviderError extends Error {
  constructor(
    message: string,
    readonly cls: ProviderErrorClass,
    readonly code?: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "MailProviderError";
  }
}

/** Classes that mean "nothing was sent, and it will not fix itself": stop the campaign, not just this email. */
export const isSystemic = (cls: ProviderErrorClass) => cls === "auth" || cls === "domain";

/** What a provider can do; callers check a flag instead of branching on the provider's name. */
export type MailCapabilities = {
  /** The provider dedupes replays of the same idempotency key (Resend). Without it the pipeline must never replay an ambiguous send. */
  idempotencyKey: boolean;
  /** Custom List-Unsubscribe / List-Unsubscribe-Post headers reach the recipient. */
  oneClickUnsubscribeHeaders: boolean;
  /** `send` returns a provider thread id, and `threadId` on a send continues that conversation. */
  threading: boolean;
  /** The mailbox can be read (list messages / threads): needs the provider's read scope, so it is per-connection, not per-provider. */
  inboxSync: boolean;
};

export interface MailProvider {
  /** The mailbox provider key (`resend`, `gmail`, `microsoft`) — also what `messages.provider` stores. */
  readonly name: string;
  readonly capabilities: MailCapabilities;
  isConfigured(): boolean;
  /** Throws `MailProviderError`. Any other thrown value is treated as a retryable network failure by the caller. */
  send(input: MailSendInput): Promise<MailSendResult>;
}

let current: MailProvider | null = null;
let overridden = false;
let factory: (() => MailProvider) | null = null;

/** The provider the app sends through. Defaults to Resend (registered by resend-provider.ts). */
export function getMailProvider(): MailProvider {
  if (current) return current;
  if (!factory) throw new Error("No mail provider registered");
  current = factory();
  return current;
}

/** Test seam (dependency inversion): install a fake; pass null to restore the real provider. */
export function setMailProvider(next: MailProvider | null): void {
  current = next;
  overridden = next !== null;
}

/** True while a test has installed its own provider with `setMailProvider`. */
export const isMailProviderOverridden = () => overridden;

export function registerMailProviderFactory(f: () => MailProvider): void {
  factory = f;
}

/** A thrown non-MailProviderError (fetch failed, timeout, DNS…) is a transient network problem. */
export function toProviderError(e: unknown): MailProviderError {
  if (e instanceof MailProviderError) return e;
  return new MailProviderError(e instanceof Error ? e.message : String(e), "retryable", "network_error");
}
