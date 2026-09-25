import type { MailboxProfile, MailboxProvider } from "./mailbox-provider";
import { MailProviderError, type MailCapabilities, type MailSendInput, type MailSendResult } from "./provider";

type Outcome = { kind: "ok" } | { kind: "error"; error: MailProviderError } | { kind: "lost_response" };

/**
 * Scripted mail provider for tests. It reproduces the one behaviour the crash-safety design depends on: replaying an
 * idempotency key returns the ORIGINAL id and does not send again (Resend keeps keys for 24 h).
 *
 *   const mail = new FakeMailProvider().failNext(new MailProviderError("slow down", "rate_limited"), 2);
 *   mail.loseNextResponse();  // provider accepted the email, but the caller never hears back (crash window)
 */
export class FakeMailProvider implements MailboxProvider {
  readonly name: string; // "resend" by default: same provider key as production so webhook correlation code is exercised as-is
  readonly capabilities: MailCapabilities;
  /** Every request that reached the provider, including replays. */
  readonly requests: MailSendInput[] = [];
  /** Emails actually "delivered" to recipients — replays of a known key are NOT added here. */
  readonly delivered: (MailSendInput & { id: string })[] = [];
  private byKey = new Map<string, string>();
  private script: Outcome[] = [];
  private seq = 0;
  configured = true;

  /**
   * `new FakeMailProvider()` behaves like Resend. `new FakeMailProvider({ name: "gmail", idempotent: false })` behaves like Gmail:
   * NO replay protection (a second `send` with the same key really sends a second email), so a test that expects one delivery
   * is proving the sending pipeline's own at-most-once guarantee.
   */
  constructor(opts: { name?: string; idempotent?: boolean; threading?: boolean } = {}) {
    this.name = opts.name ?? "resend";
    const idempotent = opts.idempotent ?? true;
    this.capabilities = {
      idempotencyKey: idempotent, oneClickUnsubscribeHeaders: true, threading: opts.threading ?? !idempotent, inboxSync: false,
    };
  }

  isConfigured() {
    return this.configured;
  }

  /** What `getProfile()` answers; tests change it to simulate the connected account or a token that no longer works. */
  profile: MailboxProfile | MailProviderError = { providerAccountId: "fake-account", email: "fake@example.com", displayName: "Fake", emailVerified: true };

  async getProfile(): Promise<MailboxProfile> {
    if (this.profile instanceof MailProviderError) throw this.profile;
    return this.profile;
  }

  failNext(error: MailProviderError, times = 1): this {
    for (let i = 0; i < times; i++) this.script.push({ kind: "error", error });
    return this;
  }

  loseNextResponse(times = 1): this {
    for (let i = 0; i < times; i++) this.script.push({ kind: "lost_response" });
    return this;
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    this.requests.push(structuredClone(input));
    const known = this.capabilities.idempotencyKey ? this.byKey.get(input.idempotencyKey) : undefined;
    if (known) return { id: known }; // idempotent replay: same answer, no second email
    const outcome = this.script.shift() ?? { kind: "ok" };
    if (outcome.kind === "error") throw outcome.error;
    const id = `fake_msg_${++this.seq}`;
    this.byKey.set(input.idempotencyKey, id);
    this.delivered.push({ ...structuredClone(input), id });
    if (outcome.kind === "lost_response") {
      // Same as the real adapters: with no idempotency key the caller must be told "maybe sent", never "retry".
      throw new MailProviderError("connection reset after the provider accepted the request", this.capabilities.idempotencyKey ? "retryable" : "unknown_outcome", "network_error");
    }
    return { id, threadId: this.capabilities.threading ? `fake_thread_${input.threadId ?? id}` : null };
  }

  /** Recipients that received an email, in order. */
  get recipients() {
    return this.delivered.map((d) => d.to);
  }
}
