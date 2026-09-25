import { sql } from "@/lib/db/client";
import { isEmailConfigured, sendCampaignEmail } from "@/lib/email/resend";
import { personalize } from "@/lib/campaigns/personalize";
import { appBaseUrl, withUnsubscribeFooter } from "@/lib/campaigns/render";
import { isOnDoNotContact, getLeadsInCooldown } from "@/lib/compliance";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";

const BATCH_SIZE = 25;

/**
 * Builder campaigns (send_model 'leads') keep per-lead state in campaign_leads. The dispatcher is still the compat
 * sender until Phase 5, so it records each outcome there: a send advances the lead; a block stops the lead and
 * cancels its remaining steps (a suppressed person must never get step 3 just because step 2 was blocked).
 */
async function markLeadSent(workspaceId: number, campaignLeadId: number, sendId: number) {
  await sql`
    update campaign_leads cl set
      current_step = greatest(cl.current_step, st.step_order),
      status = case when nxt.at is null then 'completed' else 'active' end,
      next_action_at = nxt.at,
      completed_at = case when nxt.at is null then now() else null end
    from campaign_sends cs
    join campaign_steps st on st.id = cs.step_id
    left join lateral (
      select min(p.scheduled_at) as at from campaign_sends p where p.campaign_lead_id = ${campaignLeadId} and p.status = 'pending'
    ) nxt on true
    where cs.id = ${sendId} and cl.id = ${campaignLeadId} and cl.workspace_id = ${workspaceId} and cl.status = 'active'
  `;
}

async function stopLead(workspaceId: number, campaignLeadId: number, reason: string) {
  await sql.transaction([
    sql`update campaign_leads set status = 'blocked', stop_reason = ${reason}, next_action_at = null, completed_at = now()
        where id = ${campaignLeadId} and workspace_id = ${workspaceId} and status in ('pending', 'active')`,
    sql`update campaign_sends set status = 'canceled', error_message = ${`Stopped: ${reason}`}
        where campaign_lead_id = ${campaignLeadId} and workspace_id = ${workspaceId} and status = 'pending'`,
  ]);
}

/** A builder campaign whose every lead has settled (sent all steps, or was stopped) is complete. */
async function settleCampaign(workspaceId: number, campaignLeadId: number) {
  await sql`
    update campaigns c set status = 'completed', completed_at = now(), updated_at = now()
    from campaign_leads cl
    where cl.id = ${campaignLeadId} and c.id = cl.campaign_id and c.workspace_id = ${workspaceId}
      and c.status = 'running' and c.send_model = 'leads'
      and not exists (select 1 from campaign_leads o where o.campaign_id = c.id and o.status in ('pending', 'active'))
  `;
}

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
  campaign_lead_id: number | null;
  from_email: string | null;
  mailbox_status: string | null;
  domain_status: string | null;
};

/** CAM-02: every send is rechecked for DNC and cooldown immediately before dispatch. */
async function precheckBlocked(workspaceId: number, leadId: number, leadEmail: string | null, campaignId: number) {
  if (leadEmail && (await isOnDoNotContact(workspaceId, leadEmail))) {
    return "Recipient is on the Do Not Contact list";
  }
  const cooldown = await getLeadsInCooldown(workspaceId, [leadId], undefined, { excludeCampaignId: campaignId });
  if (cooldown.has(Number(leadId))) {
    return "Recipient was contacted by another campaign within the cooldown window";
  }
  return null;
}

/**
 * Shared by the scheduled cron route (app/api/cron/send-campaigns) and the
 * admin "Send due messages now" button (lib/actions/dispatch.ts) — both must
 * run the exact same dispatch logic, not a duplicated copy.
 *
 * `workspaceId` optionally scopes the batch to a single workspace (used by
 * the manual UI trigger, so an admin can only ever dispatch their own
 * workspace's sends) — omitted, it processes across all workspaces, which is
 * what the real scheduled cron does.
 */
export async function processEmailSends(workspaceId?: number) {
  if (!isEmailConfigured()) {
    return { skipped: "email sending not configured (RESEND_API_KEY unset)" };
  }

  const dueRows = (
    workspaceId
      ? await sql`
          select
            cs.id, cs.campaign_id, cs.workspace_id, cs.lead_id, cs.channel, cs.subject, cs.body, cs.campaign_lead_id,
            l.full_name as lead_full_name, l.email as lead_email, l.company as lead_company,
            c.from_email, m.status as mailbox_status, d.status as domain_status
          from campaign_sends cs
          join leads l on l.id = cs.lead_id
          join campaigns c on c.id = cs.campaign_id
          left join mailboxes m on m.id = c.mailbox_id
          left join domains d on d.id = m.domain_id
          where cs.status = 'pending'
            and cs.channel = 'email'
            and cs.scheduled_at <= now()
            and c.status = 'running'
            and cs.workspace_id = ${workspaceId}
          order by cs.scheduled_at asc
          limit ${BATCH_SIZE}
        `
      : await sql`
          select
            cs.id, cs.campaign_id, cs.workspace_id, cs.lead_id, cs.channel, cs.subject, cs.body, cs.campaign_lead_id,
            l.full_name as lead_full_name, l.email as lead_email, l.company as lead_company,
            c.from_email, m.status as mailbox_status, d.status as domain_status
          from campaign_sends cs
          join leads l on l.id = cs.lead_id
          join campaigns c on c.id = cs.campaign_id
          left join mailboxes m on m.id = c.mailbox_id
          left join domains d on d.id = m.domain_id
          where cs.status = 'pending'
            and cs.channel = 'email'
            and cs.scheduled_at <= now()
            and c.status = 'running'
          order by cs.scheduled_at asc
          limit ${BATCH_SIZE}
        `
  ) as DueSendRow[];

  let sent = 0;
  let failed = 0;
  let blocked = 0;

  for (const row of dueRows) {
    if (!row.lead_email) {
      await sql`
        update campaign_sends set status = 'failed', error_message = 'Lead has no email address'
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      failed++;
      continue;
    }

    // DEL-01: re-verify the sending identity immediately before dispatch too —
    // a mailbox can be paused, or a domain can lose verification, after the
    // campaign was approved but before every scheduled send has gone out.
    if (!row.from_email || row.mailbox_status !== "active" || row.domain_status !== "verified") {
      await sql`
        update campaign_sends
        set status = 'blocked', error_message = 'Sending mailbox is no longer active on a verified domain'
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      blocked++;
      continue;
    }

    // CAM-02 / CRM-06: re-check DNC and cooldown immediately before send — a
    // lead can be suppressed, or contacted by another campaign, after
    // enrollment but before this scheduled send fires.
    const blockReason = await precheckBlocked(row.workspace_id, row.lead_id, row.lead_email, row.campaign_id);
    if (blockReason) {
      await sql`
        update campaign_sends set status = 'blocked', error_message = ${blockReason}
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      if (row.campaign_lead_id) {
        await stopLead(row.workspace_id, row.campaign_lead_id, blockReason);
        await settleCampaign(row.workspace_id, row.campaign_lead_id);
      }
      blocked++;
      continue;
    }

    const lead = { full_name: row.lead_full_name, company: row.lead_company };
    const subject = personalize(row.subject ?? "", lead);
    const unsubscribeUrl = buildUnsubscribeUrl(appBaseUrl(), row.workspace_id, row.lead_email);
    const body = withUnsubscribeFooter(personalize(row.body, lead), unsubscribeUrl);

    try {
      const result = await sendCampaignEmail({ to: row.lead_email, from: row.from_email, subject, body });
      await sql`
        update campaign_sends
        set status = 'sent', sent_at = now(), subject = ${subject}, body = ${body}, provider_message_id = ${result?.id ?? null}
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      await sql`
        update campaigns set sent_count = sent_count + 1
        where id = ${row.campaign_id} and workspace_id = ${row.workspace_id}
      `;
      if (row.campaign_lead_id) {
        await markLeadSent(row.workspace_id, row.campaign_lead_id, row.id);
        await settleCampaign(row.workspace_id, row.campaign_lead_id);
      }
      sent++;
    } catch (error) {
      await sql`
        update campaign_sends
        set status = 'failed', error_message = ${error instanceof Error ? error.message : "Send failed"}
        where id = ${row.id} and workspace_id = ${row.workspace_id}
      `;
      failed++;
    }
  }

  return { sent, failed, blocked, processed: dueRows.length };
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
