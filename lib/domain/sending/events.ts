import { sql } from "@/lib/db/client";
import { suppressEmail } from "./suppression";

/**
 * Provider delivery events → message state (WP5.4). Idempotent on the provider's own event id: the same webhook delivered
 * twice is recorded once and changes nothing the second time. Message status only moves FORWARD (sent → delivered →
 * bounced/complained), so a late or out-of-order event can't un-bounce an address.
 */

export type ProviderEvent = {
  eventId: string;
  type: string;
  providerMessageId: string;
  occurredAt: Date;
  bounce?: { type?: string; subType?: string; message?: string } | null;
  suppressed?: { type?: string } | null;
  payload: unknown;
};

export type EventOutcome = { matched: boolean; recorded: boolean; suppressed: boolean };

const SOFT_BOUNCE_LIMIT = 3;

export async function applyProviderEvent(e: ProviderEvent): Promise<EventOutcome> {
  // workspace-scope-ok: a webhook arrives without a session; the workspace is DERIVED from the provider message id it refers to.
  const found = await sql`/* workspace-scope-ok */ select id, workspace_id, to_email, lead_id from messages where provider = 'resend' and provider_message_id = ${e.providerMessageId}`;
  const m = found[0];
  if (!m) return { matched: false, recorded: false, suppressed: false };
  const workspaceId = Number(m.workspace_id);
  const messageId = Number(m.id);

  const inserted = await sql`
    insert into message_events (workspace_id, message_id, type, provider, provider_event_id, occurred_at, payload)
    values (${workspaceId}, ${messageId}, ${e.type}, 'resend', ${e.eventId}, ${e.occurredAt.toISOString()}::timestamptz, ${JSON.stringify(e.payload ?? {})})
    on conflict (provider, provider_event_id) do nothing returning id`;
  if (inserted.length === 0) return { matched: true, recorded: false, suppressed: false }; // duplicate delivery

  const at = e.occurredAt.toISOString();
  const toEmail = String(m.to_email);
  const leadId = m.lead_id === null ? null : Number(m.lead_id);
  let suppressed = false;

  switch (e.type) {
    case "email.delivered":
      await sql`update messages set status = case when status in ('sending', 'sent') then 'delivered' else status end, delivered_at = coalesce(delivered_at, ${at}::timestamptz), updated_at = now()
                where id = ${messageId} and workspace_id = ${workspaceId}`;
      break;
    case "email.opened":
      await sql`update messages set opened_at = coalesce(opened_at, ${at}::timestamptz), updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId}`;
      break;
    case "email.clicked":
      await sql`update messages set clicked_at = coalesce(clicked_at, ${at}::timestamptz), updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId}`;
      break;
    case "email.bounced": {
      if ((e.bounce?.type ?? "").toLowerCase() === "permanent") {
        await sql`update messages set status = 'bounced', bounced_at = coalesce(bounced_at, ${at}::timestamptz), error = ${e.bounce?.message ?? "Hard bounce"}, updated_at = now()
                  where id = ${messageId} and workspace_id = ${workspaceId}`;
        await suppressEmail(workspaceId, toEmail, { reason: "Hard bounce", source: "resend_webhook", leadStatus: "bounced" }, { leadId });
        suppressed = true;
      } else {
        // A soft/transient bounce is retried by the provider; only a pattern of them stops the address.
        const r = await sql`update messages set soft_bounce_count = soft_bounce_count + 1, updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId} returning soft_bounce_count`;
        const total = await sql`select count(*)::int as n from message_events ev join messages mm on mm.id = ev.message_id
                                where ev.workspace_id = ${workspaceId} and lower(mm.to_email) = ${toEmail.toLowerCase()} and ev.type = 'email.bounced'`;
        if (Number(r[0]?.soft_bounce_count ?? 0) >= SOFT_BOUNCE_LIMIT || Number(total[0].n) >= SOFT_BOUNCE_LIMIT) {
          await suppressEmail(workspaceId, toEmail, { reason: "Repeated soft bounces", source: "resend_webhook", leadStatus: "bounced" }, { leadId });
          suppressed = true;
        }
      }
      break;
    }
    case "email.complained":
      await sql`update messages set status = 'complained', complained_at = coalesce(complained_at, ${at}::timestamptz), updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId}`;
      await suppressEmail(workspaceId, toEmail, { reason: "Spam complaint", source: "resend_webhook", leadStatus: "unsubscribed" }, { leadId });
      suppressed = true;
      break;
    case "email.suppressed":
      await suppressEmail(workspaceId, toEmail, { reason: `Provider-suppressed (${e.suppressed?.type ?? "unknown"})`, source: "resend_webhook", leadStatus: "bounced" }, { leadId });
      suppressed = true;
      break;
    case "email.failed":
      await sql`update messages set status = 'failed', error = 'The provider reported that the email failed to send', error_class = 'provider_reported', failed_at = ${at}::timestamptz, updated_at = now()
                where id = ${messageId} and workspace_id = ${workspaceId} and status in ('sending', 'sent')`;
      break;
    default:
      break; // email.sent / delivery_delayed / scheduled: recorded above, nothing to change
  }
  return { matched: true, recorded: true, suppressed };
}
