import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { settleCampaignStmt } from "./lead-state";

/** Systemic problems pause the WHOLE campaign; a bad recipient only fails its own email. */

/** Pauses a running campaign because sending itself is broken. Idempotent; returns false if it wasn't running. */
export async function pauseCampaignBySystem(workspaceId: number, campaignId: number, reason: string): Promise<boolean> {
  const moved = await sql`
    update campaigns set status = 'paused', paused_at = now(), paused_reason = ${reason.slice(0, 500)}, updated_at = now()
    where id = ${campaignId} and workspace_id = ${workspaceId} and status = 'running' returning name`;
  if (moved.length === 0) return false;
  await sql`update campaign_leads set next_action_at = null where campaign_id = ${campaignId} and workspace_id = ${workspaceId} and status = 'active'`;
  await logActivity({
    workspaceId, actorUserId: null, type: "campaign.auto_paused", entityType: "campaign", entityId: campaignId,
    summary: `Paused "${moved[0].name}" automatically: ${reason}`,
  });
  return true;
}

/** How many sends failed for provider-side reasons in the last `minutes` — a burst of them means an outage, not bad recipients. */
export async function recentProviderFailures(workspaceId: number, campaignId: number, since: Date): Promise<number> {
  const rows = await sql`
    select count(*)::int as n from messages
    where workspace_id = ${workspaceId} and campaign_id = ${campaignId} and status = 'failed'
      and error_class in ('retryable', 'rate_limited', 'quota') and failed_at >= ${since.toISOString()}::timestamptz`;
  return Number(rows[0].n);
}

export const OUTAGE_FAILURE_THRESHOLD = 5;

// ---- operator tools: retry / skip -----------------------------------------------------------------------------------

type FailedSend = { id: number; campaignId: number; campaignLeadId: number | null; status: string; leadStatus: string | null; stopReason: string | null };

async function loadFailedSend(workspaceId: number, sendId: number): Promise<FailedSend> {
  const rows = await sql`
    select cs.id, cs.campaign_id, cs.campaign_lead_id, cs.status, cl.status as lead_status, cl.stop_reason
    from campaign_sends cs left join campaign_leads cl on cl.id = cs.campaign_lead_id
    where cs.id = ${sendId} and cs.workspace_id = ${workspaceId}`;
  const r = rows[0];
  if (!r) throw new AppError("NOT_FOUND", "Send not found.");
  if (r.status !== "failed") throw new AppError("CONFLICT", "Only failed sends can be retried or skipped.");
  return { id: Number(r.id), campaignId: Number(r.campaign_id), campaignLeadId: r.campaign_lead_id === null ? null : Number(r.campaign_lead_id), status: String(r.status), leadStatus: (r.lead_status as string | null) ?? null, stopReason: (r.stop_reason as string | null) ?? null };
}

/** Puts the lead back in the sequence after a failure had stopped it: restores the later steps that the stop canceled. */
async function reactivateLead(workspaceId: number, f: FailedSend) {
  if (f.campaignLeadId === null || f.leadStatus !== "failed") return;
  await sql.transaction([
    sql`update campaign_sends set status = 'pending', error_message = null
        where campaign_lead_id = ${f.campaignLeadId} and workspace_id = ${workspaceId} and status = 'canceled' and error_message = ${`Stopped: ${f.stopReason}`}`,
    sql`update campaign_leads set status = 'active', stop_reason = null, completed_at = null where id = ${f.campaignLeadId} and workspace_id = ${workspaceId}`,
  ]);
}

/** Retry now: the send goes back to `pending` and due immediately; the worker picks it up on its next tick. */
export async function retryFailedSend(workspaceId: number, userId: number | null, sendId: number): Promise<void> {
  const f = await loadFailedSend(workspaceId, sendId);
  await reactivateLead(workspaceId, f);
  await sql`update campaign_sends set status = 'pending', error_message = null, scheduled_at = now() where id = ${sendId} and workspace_id = ${workspaceId}`;
  if (f.campaignLeadId !== null) {
    await sql`update campaign_leads set next_action_at = now() where id = ${f.campaignLeadId} and workspace_id = ${workspaceId} and status = 'active'`;
  }
  await logActivity({ workspaceId, actorUserId: userId, type: "campaign.send_retried", entityType: "campaign", entityId: f.campaignId, summary: `Retrying failed email #${sendId}` });
}

/** Skip: this email is dropped, the rest of the sequence carries on. */
export async function skipFailedSend(workspaceId: number, userId: number | null, sendId: number): Promise<void> {
  const f = await loadFailedSend(workspaceId, sendId);
  await reactivateLead(workspaceId, f);
  await sql.transaction([
    sql`update campaign_sends set status = 'canceled', error_message = 'Skipped by a person' where id = ${sendId} and workspace_id = ${workspaceId}`,
    ...(f.campaignLeadId !== null
      ? [
          sql`update campaign_leads cl set next_action_at = (select min(p.scheduled_at) from campaign_sends p where p.campaign_lead_id = cl.id and p.status = 'pending'),
                status = case when exists (select 1 from campaign_sends p where p.campaign_lead_id = cl.id and p.status = 'pending') then 'active' else 'completed' end
              where cl.id = ${f.campaignLeadId} and cl.workspace_id = ${workspaceId} and cl.status in ('active', 'failed')`,
          settleCampaignStmt(workspaceId, f.campaignId),
        ]
      : []),
  ]);
  await logActivity({ workspaceId, actorUserId: userId, type: "campaign.send_skipped", entityType: "campaign", entityId: f.campaignId, summary: `Skipped failed email #${sendId}` });
}

