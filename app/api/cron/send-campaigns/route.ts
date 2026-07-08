import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { isEmailConfigured, sendCampaignEmail } from "@/lib/email/resend";
import { personalize } from "@/lib/campaigns/personalize";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 25;

type DueSendRow = {
  id: number;
  campaign_id: number;
  channel: string;
  subject: string | null;
  body: string;
  lead_full_name: string;
  lead_email: string | null;
  lead_company: string | null;
};

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized();
  }

  const emailResult = await processEmailSends();
  const linkedinResult = await processLinkedinSends();

  return NextResponse.json({ email: emailResult, linkedin: linkedinResult });
}

async function processEmailSends() {
  if (!isEmailConfigured()) {
    return { skipped: "email sending not configured (RESEND_API_KEY / RESEND_FROM_EMAIL unset)" };
  }

  const dueRows = (await sql`
    select
      cs.id, cs.campaign_id, cs.channel, cs.subject, cs.body,
      l.full_name as lead_full_name, l.email as lead_email, l.company as lead_company
    from campaign_sends cs
    join leads l on l.id = cs.lead_id
    join campaigns c on c.id = cs.campaign_id
    where cs.status = 'pending'
      and cs.channel = 'email'
      and cs.scheduled_at <= now()
      and c.status = 'running'
    order by cs.scheduled_at asc
    limit ${BATCH_SIZE}
  `) as DueSendRow[];

  let sent = 0;
  let failed = 0;

  for (const row of dueRows) {
    if (!row.lead_email) {
      await sql`
        update campaign_sends set status = 'failed', error_message = 'Lead has no email address'
        where id = ${row.id}
      `;
      failed++;
      continue;
    }

    const lead = { full_name: row.lead_full_name, company: row.lead_company };
    const subject = personalize(row.subject ?? "", lead);
    const body = personalize(row.body, lead);

    try {
      await sendCampaignEmail({ to: row.lead_email, subject, body });
      await sql`
        update campaign_sends
        set status = 'sent', sent_at = now(), subject = ${subject}, body = ${body}
        where id = ${row.id}
      `;
      await sql`
        update campaigns set sent_count = sent_count + 1 where id = ${row.campaign_id}
      `;
      sent++;
    } catch (error) {
      await sql`
        update campaign_sends
        set status = 'failed', error_message = ${error instanceof Error ? error.message : "Send failed"}
        where id = ${row.id}
      `;
      failed++;
    }
  }

  return { sent, failed, processed: dueRows.length };
}

async function processLinkedinSends() {
  const dueRows = (await sql`
    select
      cs.id, cs.campaign_id, cs.channel, cs.subject, cs.body,
      l.full_name as lead_full_name, l.email as lead_email, l.company as lead_company
    from campaign_sends cs
    join leads l on l.id = cs.lead_id
    join campaigns c on c.id = cs.campaign_id
    where cs.status = 'pending'
      and cs.channel = 'linkedin_dm'
      and cs.scheduled_at <= now()
      and c.status = 'running'
    order by cs.scheduled_at asc
    limit ${BATCH_SIZE}
  `) as DueSendRow[];

  for (const row of dueRows) {
    const lead = { full_name: row.lead_full_name, company: row.lead_company };
    const body = personalize(row.body, lead);
    await sql`
      update campaign_sends set status = 'queued', body = ${body}
      where id = ${row.id}
    `;
  }

  return { queued: dueRows.length };
}
