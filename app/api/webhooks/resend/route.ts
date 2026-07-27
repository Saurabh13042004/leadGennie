import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { sql } from "@/lib/db/client";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

type ResendWebhookEvent = {
  type: string;
  data: {
    email_id: string;
    to: string[];
    bounce?: { type: string };
    suppressed?: { type: string };
  };
};

/**
 * DEL-03: hard bounces and spam complaints immediately suppress the affected
 * address — before any later step of the sequence can send to it.
 *
 * Verification is done directly with `standardwebhooks` (the spec Resend's
 * webhooks follow) rather than `resend.webhooks.verify()` — that method
 * requires constructing a full Resend API client, which throws if
 * RESEND_API_KEY isn't set even though verifying a signature needs no API
 * call at all. Keeping this decoupled means bounce/complaint suppression
 * works independently of whether outbound sending is configured.
 */
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "RESEND_WEBHOOK_SECRET is not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const id = request.headers.get("webhook-id");
  const timestamp = request.headers.get("webhook-timestamp");
  const signature = request.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) {
    return NextResponse.json({ error: "Missing webhook signature headers" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    const verified = new Webhook(secret).verify(payload, {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": signature,
    });
    event = verified as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (event.type !== "email.bounced" && event.type !== "email.complained" && event.type !== "email.suppressed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const emailId = event.data.email_id;
  const toEmail = event.data.to?.[0];
  if (!toEmail) {
    return NextResponse.json({ ok: true, correlated: false });
  }

  // Correlate via provider_message_id (Resend's own send id), not just the
  // recipient address — the same address could be a lead in more than one
  // workspace, and this is the only reliable way to know which one sent it.
  const rows = await sql`
    select workspace_id, lead_id from campaign_sends where provider_message_id = ${emailId} limit 1
  `;
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ ok: true, correlated: false });
  }
  const workspaceId = row.workspace_id as number;

  let reason: string | null = null;
  if (event.type === "email.complained") {
    reason = "Spam complaint";
  } else if (event.type === "email.suppressed") {
    reason = `Provider-suppressed (${event.data.suppressed?.type ?? "unknown"})`;
  } else if (event.type === "email.bounced") {
    // Only a hard/permanent bounce suppresses immediately — a transient/soft
    // bounce (mailbox full, temporary provider issue) does not.
    if (event.data.bounce?.type?.toLowerCase() === "permanent") {
      reason = "Hard bounce";
    }
  }

  if (reason) {
    await sql`
      insert into do_not_contact (workspace_id, email, reason, source)
      values (${workspaceId}, ${toEmail.toLowerCase()}, ${reason}, 'resend_webhook')
      on conflict (workspace_id, lower(email)) do nothing
    `;
    await logActivity({
      workspaceId,
      actorUserId: null,
      type: "compliance.auto_suppressed",
      entityType: "lead",
      entityId: row.lead_id as number,
      summary: `${toEmail} added to Do Not Contact (${reason}) via Resend webhook`,
    });
  }

  return NextResponse.json({ ok: true, suppressed: Boolean(reason) });
}
