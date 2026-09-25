import { Webhook } from "standardwebhooks";
import { AppError, ok, withApi } from "@/lib/api";
import { applyProviderEvent } from "@/lib/domain/sending/events";

export const dynamic = "force-dynamic";

type ResendWebhookEvent = {
  type: string;
  created_at?: string;
  data: {
    email_id: string;
    to?: string[];
    bounce?: { type?: string; subType?: string; message?: string };
    suppressed?: { type?: string };
  };
};

/**
 * Resend delivery events: sent · delivered · delivery_delayed · bounced · complained · opened · clicked · failed · suppressed.
 *
 * Signature-verified with `standardwebhooks` (the spec Resend's webhooks follow) rather than the SDK — verifying needs no
 * API call, so bounce/complaint suppression keeps working even if outbound sending isn't configured. Idempotent on the
 * webhook's own id (`webhook-id`): a redelivery is acknowledged and changes nothing (see lib/domain/sending/events.ts).
 */
export const POST = withApi(async (request) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) throw new AppError("NOT_CONFIGURED", "RESEND_WEBHOOK_SECRET is not configured.");

  const payload = await request.text();
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) throw new AppError("UNAUTHENTICATED", "Missing webhook signature headers");

  let event: ResendWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, { "webhook-id": id, "webhook-timestamp": timestamp, "webhook-signature": signature }) as ResendWebhookEvent;
  } catch {
    throw new AppError("UNAUTHENTICATED", "Invalid signature");
  }

  if (!event.type?.startsWith("email.") || !event.data?.email_id) return ok({ ignored: event.type ?? "unknown" });

  const occurred = event.created_at ? new Date(event.created_at) : new Date();
  const outcome = await applyProviderEvent({
    eventId: id, type: event.type, providerMessageId: event.data.email_id, occurredAt: Number.isNaN(occurred.getTime()) ? new Date() : occurred,
    bounce: event.data.bounce ?? null, suppressed: event.data.suppressed ?? null, payload: event,
  });
  return ok({ correlated: outcome.matched, duplicate: outcome.matched && !outcome.recorded, suppressed: outcome.suppressed });
});
