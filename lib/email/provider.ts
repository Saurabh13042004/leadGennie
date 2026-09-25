/**
 * Outbound mail provider port. Everything that sends email depends on this interface, never on a vendor SDK, so Resend
 * can be swapped for Gmail/Outlook (D-04) and tests can use a fake with the same contract (Liskov).
 */

export type MailSendInput = {
  from: string;
  to: string;
  subject: string;
  text: string;
  /** Optional HTML alternative (transactional mail); `text` stays the plain-text part and is always required. */
  html?: string;
  headers?: Record<string, string>;
  /** Replaying the same key with the same payload must NOT send a second email. */
  idempotencyKey: string;
  tags?: { name: string; value: string }[];
};

export type MailSendResult = { id: string };

/**
 * What kind of failure this was — decides the response:
 *  retryable / rate_limited / quota : try again later (backoff)
 *  permanent                        : this email can never be sent (bad recipient, rejected content) — fail it, don't retry
 *  auth / domain                    : the whole sending setup is broken (bad key, unverified domain) — pause the campaign
 */
export type ProviderErrorClass = "retryable" | "rate_limited" | "quota" | "permanent" | "auth" | "domain";

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

export interface MailProvider {
  readonly name: string;
  readonly capabilities: { idempotencyKey: boolean; oneClickUnsubscribeHeaders: boolean };
  isConfigured(): boolean;
  /** Throws `MailProviderError`. Any other thrown value is treated as a retryable network failure by the caller. */
  send(input: MailSendInput): Promise<MailSendResult>;
}

let current: MailProvider | null = null;
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
}

export function registerMailProviderFactory(f: () => MailProvider): void {
  factory = f;
}

/** A thrown non-MailProviderError (fetch failed, timeout, DNS…) is a transient network problem. */
export function toProviderError(e: unknown): MailProviderError {
  if (e instanceof MailProviderError) return e;
  return new MailProviderError(e instanceof Error ? e.message : String(e), "retryable", "network_error");
}
