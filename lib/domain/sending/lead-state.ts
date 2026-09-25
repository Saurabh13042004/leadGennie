import { sql } from "@/lib/db/client";

/**
 * Per-lead sequence state for builder campaigns (send_model 'leads'), as transaction-ready statements so the send
 * handler can record "sent" for the message, the send, the lead and the campaign in ONE atomic write.
 */

/** After step k went out: the next step waits its `wait_days` from NOW, not from when it was originally planned. */
export const shiftNextStepStmt = (workspaceId: number, campaignLeadId: number, now: Date) => sql`
  update campaign_sends nx set scheduled_at = greatest(nx.scheduled_at, ${now.toISOString()}::timestamptz + make_interval(days => st.wait_days))
  from campaign_steps st
  where st.id = nx.step_id and nx.workspace_id = ${workspaceId}
    and nx.id = (
      select p.id from campaign_sends p join campaign_steps ps on ps.id = p.step_id
      where p.campaign_lead_id = ${campaignLeadId} and p.status = 'pending' order by ps.step_order limit 1
    )`;

export const markLeadSentStmt = (workspaceId: number, campaignLeadId: number, sendId: number) => sql`
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
  where cs.id = ${sendId} and cl.id = ${campaignLeadId} and cl.workspace_id = ${workspaceId} and cl.status = 'active'`;

/** A builder campaign whose every lead has settled (finished all steps, or was stopped) is complete. */
export const settleCampaignStmt = (workspaceId: number, campaignId: number) => sql`
  update campaigns c set status = 'completed', completed_at = now(), updated_at = now()
  where c.id = ${campaignId} and c.workspace_id = ${workspaceId} and c.status = 'running' and c.send_model = 'leads'
    and not exists (select 1 from campaign_leads o where o.campaign_id = c.id and o.status in ('pending', 'active'))`;

/** A blocked/failed lead stops: their remaining steps are canceled — nobody gets step 3 because step 2 was blocked. */
export async function stopLead(workspaceId: number, campaignLeadId: number, campaignId: number, reason: string, leadStatus: "blocked" | "failed" = "blocked") {
  await sql.transaction([
    sql`update campaign_leads set status = ${leadStatus}, stop_reason = ${reason}, next_action_at = null, completed_at = now()
        where id = ${campaignLeadId} and workspace_id = ${workspaceId} and status in ('pending', 'active')`,
    sql`update campaign_sends set status = 'canceled', error_message = ${`Stopped: ${reason}`}
        where campaign_lead_id = ${campaignLeadId} and workspace_id = ${workspaceId} and status = 'pending'`,
    settleCampaignStmt(workspaceId, campaignId),
  ]);
}
