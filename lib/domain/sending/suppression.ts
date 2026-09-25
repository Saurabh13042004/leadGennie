import { sql } from "@/lib/db/client";
import { logActivity } from "@/lib/activity";

export type SuppressionReason = { reason: string; source: string; leadStatus: "unsubscribed" | "bounced" };

/**
 * One place that turns "this address must never be emailed" into effect — used by the unsubscribe link, the provider
 * webhook (hard bounce / spam complaint / provider suppression) and anything else that suppresses.
 *
 *  1. records it on the Do Not Contact list (idempotent),
 *  2. stops every campaign_lead for that address in the workspace, in EVERY campaign,
 *  3. cancels their pending sends, and completes any campaign that has nobody left.
 *
 * Send-time prechecks still re-check the list before each email (defense in depth), but stopping here means nothing
 * is even queued for them, and the campaign page shows why.
 */
export async function suppressEmail(
  workspaceId: number,
  email: string,
  s: SuppressionReason,
  opts: { leadId?: number | null } = {},
): Promise<{ stoppedLeads: number; canceledSends: number }> {
  const addr = email.trim().toLowerCase();
  const [, stopped, canceled] = await sql.transaction([
    sql`insert into do_not_contact (workspace_id, email, reason, source) values (${workspaceId}, ${addr}, ${s.reason}, ${s.source})
        on conflict (workspace_id, lower(email)) do nothing`,
    sql`update campaign_leads cl set status = ${s.leadStatus}, stop_reason = ${s.reason}, next_action_at = null, completed_at = now()
        from leads l
        where l.id = cl.lead_id and l.workspace_id = cl.workspace_id and lower(l.email) = ${addr}
          and cl.workspace_id = ${workspaceId} and cl.status in ('pending', 'active') returning cl.campaign_id`,
    sql`update campaign_sends cs set status = 'canceled', error_message = ${`Stopped: ${s.reason}`}
        from leads l
        where l.id = cs.lead_id and l.workspace_id = cs.workspace_id and lower(l.email) = ${addr}
          and cs.workspace_id = ${workspaceId} and cs.status = 'pending' returning cs.id`,
  ]);
  const campaignIds = [...new Set(stopped.map((r) => Number(r.campaign_id)))];
  if (campaignIds.length > 0) {
    await sql`
      update campaigns c set status = 'completed', completed_at = now(), updated_at = now()
      where c.workspace_id = ${workspaceId} and c.id = any(${campaignIds}::bigint[]) and c.status = 'running' and c.send_model = 'leads'
        and not exists (select 1 from campaign_leads o where o.campaign_id = c.id and o.status in ('pending', 'active'))`;
  }
  if (stopped.length > 0 || canceled.length > 0) {
    await logActivity({
      workspaceId, actorUserId: null, type: "compliance.sequences_stopped", entityType: "lead", entityId: opts.leadId ?? null,
      summary: `${addr}: ${s.reason} — stopped ${stopped.length} sequence(s), canceled ${canceled.length} pending email(s)`,
    });
  }
  return { stoppedLeads: stopped.length, canceledSends: canceled.length };
}
