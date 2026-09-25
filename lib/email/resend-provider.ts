import { getResendClient, isEmailConfigured } from "@/lib/email/resend";
import { MailProviderError, registerMailProviderFactory, type MailProvider, type MailSendInput, type MailSendResult, type ProviderErrorClass } from "./provider";

/**
 * Maps a Resend API error onto our classes. Names/status codes are Resend's documented error codes
 * (https://resend.com/docs/api-reference/errors); an unknown 4xx is treated as permanent (this email is bad) and an
 * unknown 5xx as retryable — never the reverse, so a bug can't cause endless retries of a rejected email or drop a good one.
 */
export function classifyResendError(err: { name?: string; message?: string; statusCode?: number | null }): { cls: ProviderErrorClass; retryAfterSeconds?: number } {
  const name = err.name ?? "";
  const status = err.statusCode ?? 0;
  const msg = (err.message ?? "").toLowerCase();
  if (["missing_api_key", "invalid_api_key", "restricted_api_key"].includes(name) || status === 401) return { cls: "auth" };
  // "The gennie.dev domain is not verified" arrives as a validation/403 error — it is the domain, not the recipient.
  if (/domain.*(not verified|is not verified|not found)|verify.*domain|domain is not/.test(msg) || (status === 403 && name !== "rate_limit_exceeded")) return { cls: "domain" };
  // Quota errors are 429s too, so they must be matched before the generic 429 rule.
  if (name === "daily_quota_exceeded") return { cls: "quota", retryAfterSeconds: 3600 };
  if (name === "monthly_quota_exceeded") return { cls: "auth" }; // won't recover until the plan changes: pause, don't spin
  if (name === "rate_limit_exceeded" || status === 429) return { cls: "rate_limited", retryAfterSeconds: 30 };
  if (name === "concurrent_idempotent_requests") return { cls: "retryable", retryAfterSeconds: 5 };
  if (name === "invalid_idempotent_request") return { cls: "permanent" };
  if (["internal_server_error", "application_error"].includes(name) || status >= 500) return { cls: "retryable" };
  if (status >= 400 && status < 500) return { cls: "permanent" };
  return { cls: "retryable" };
}

export class ResendProvider implements MailProvider {
  readonly name = "resend";
  readonly capabilities = { idempotencyKey: true, oneClickUnsubscribeHeaders: true };

  isConfigured() {
    return isEmailConfigured();
  }

  async send(input: MailSendInput): Promise<MailSendResult> {
    let res;
    try {
      res = await getResendClient().emails.send(
        { from: input.from, to: input.to, subject: input.subject, text: input.text, html: input.html, headers: input.headers, tags: input.tags },
        { idempotencyKey: input.idempotencyKey },
      );
    } catch (e) {
      throw new MailProviderError(e instanceof Error ? e.message : "Network error calling Resend", "retryable", "network_error");
    }
    if (res.error) {
      const c = classifyResendError(res.error);
      throw new MailProviderError(res.error.message, c.cls, res.error.name, c.retryAfterSeconds);
    }
    if (!res.data?.id) throw new MailProviderError("Resend returned no message id", "retryable", "no_id");
    return { id: res.data.id };
  }
}

registerMailProviderFactory(() => new ResendProvider());
