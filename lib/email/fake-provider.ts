import { MailProviderError, type MailProvider, type MailSendInput, type MailSendResult } from "./provider";

type Outcome = { kind: "ok" } | { kind: "error"; error: MailProviderError } | { kind: "lost_response" };

/**
 * Scripted mail provider for tests. It reproduces the one behaviour the crash-safety design depends on: replaying an
 * idempotency key returns the ORIGINAL id and does not send again (Resend keeps keys for 24 h).
 *
 *   const mail = new FakeMailProvider().failNext(new MailProviderError("slow down", "rate_limited"), 2);
 *   mail.loseNextResponse();  // provider accepted the email, but the caller never hears back (crash window)
 */
export class FakeMailProvider implements MailProvider {
  readonly name = "resend"; // same provider key as production so webhook correlation code is exercised as-is
  readonly capabilities = { idempotencyKey: true, oneClickUnsubscribeHeaders: true };
  /** Every request that reached the provider, including replays. */
  readonly requests: MailSendInput[] = [];
  /** Emails actually "delivered" to recipients — replays of a known key are NOT added here. */
  readonly delivered: (MailSendInput & { id: string })[] = [];
  private byKey = new Map<string, string>();
  private script: Outcome[] = [];
  private seq = 0;
  configured = true;

  isConfigured() {
    return this.configured;
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
    const known = this.byKey.get(input.idempotencyKey);
    if (known) return { id: known }; // idempotent replay: same answer, no second email
    const outcome = this.script.shift() ?? { kind: "ok" };
    if (outcome.kind === "error") throw outcome.error;
    const id = `fake_msg_${++this.seq}`;
    this.byKey.set(input.idempotencyKey, id);
    this.delivered.push({ ...structuredClone(input), id });
    if (outcome.kind === "lost_response") throw new MailProviderError("connection reset after the provider accepted the request", "retryable", "network_error");
    return { id };
  }

  /** Recipients that received an email, in order. */
  get recipients() {
    return this.delivered.map((d) => d.to);
  }
}
