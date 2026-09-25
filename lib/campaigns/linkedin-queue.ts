import { sql } from "@/lib/db/client";
import { personalize } from "@/lib/campaigns/personalize";
import { getLeadsInCooldown, isOnDoNotContact } from "@/lib/compliance";

const BATCH_SIZE = 25;

type DueSendRow = {
  id: number;
  campaign_id: number;
  workspace_id: number;
  lead_id: number;
  channel: string;
  subject: string | null;
  body: string;
  lead_full_name: string;
  lead_email: string | null;
  lead_company: string | null;
};

/**
 * LinkedIn DMs are NOT sent by the server: this only moves due DMs to `queued` so the Chrome extension can pick them up
 * (D-05: the extension queue is switched off in Phase 7; existing campaigns keep working until then). Email is sent only
 * by `campaign_send` jobs (lib/domain/sending) — this file no longer sends anything.
 */
async function precheckBlocked(workspaceId: number, leadId: number, leadEmail: string | null, campaignId: number) {
  if (leadEmail && (await isOnDoNotContact(workspaceId, leadEmail))) return "Recipient is on the Do Not Contact list";
  const cooldown = await getLeadsInCooldown(workspaceId, [leadId], undefined, { excludeCampaignId: campaignId });
  if (cooldown.has(Number(leadId))) return "Recipient was contacted by another campaign within the cooldown window";
  return null;
}

export async function processLinkedinSends(workspaceId?: number) {
  const dueRows = (
    workspaceId
      ? await sql`
          select
            cs.id, cs.campaign_id, cs.workspace_id, cs.lead_id, cs.channel, cs.subject, cs.body,
            l.full_name as lead_full_name, l.email as lead_email, l.company as lead_company
          from campaign_sends cs
          join leads l on l.id = cs.lead_id
          join campaigns c on c.id = cs.campaign_id
          where cs.status = 'pending'
            and cs.channel = 'linkedin_dm'
            and cs.scheduled_at <= now()
            and c.status = 'running'
            and cs.workspace_id = ${workspaceId}
          order by cs.scheduled_at asc
          limit ${BATCH_SIZE}
        `
      : await sql`
          select
            cs.id, cs.campaign_id, cs.workspace_id, cs.lead_id, cs.channel, cs.subject, cs.body,
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
        `
  ) as DueSendRow[];

  let queued = 0;
  let blocked = 0;

  for (const row of dueRows) {
    // CAM-02 / CRM-06: LinkedIn DMs go through the Chrome extension queue, not
    // this process directly, but the same immediate-pre-action recheck applies.
    const blockReason = await precheckBlocked(row.workspace_id, row.lead_id, row.lead_email, row.campaign_id);
    if (blockReason) {
      await sql`
        update campaign_sends set status = 'blocked', error_message = ${blockReason}
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      blocked++;
      continue;
    }

    const lead = { full_name: row.lead_full_name, company: row.lead_company };
    const body = personalize(row.body, lead);
    await sql`
      update campaign_sends set status = 'queued', body = ${body}
      where id = ${row.id} and workspace_id = ${row.workspace_id}
    `;
    queued++;
  }

  return { queued, blocked };
}
