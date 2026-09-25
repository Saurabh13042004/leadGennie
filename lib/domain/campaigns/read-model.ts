import { sql } from "@/lib/db/client";
import { loadCampaign } from "./repository";
import type { CampaignRecord, CampaignStatus, SendModel } from "./types";

/** What the campaign list and detail pages show. Only counts of real rows — no rates computed from nothing. */

export type CampaignListItem = {
  id: number;
  name: string;
  status: CampaignStatus;
  sendModel: SendModel;
  audienceSize: number;
  excluded: number;
  sent: number;
  /** Replies are only tracked once reply ingestion exists (Phase 6); until then this is null, never 0. */
  replied: number | null;
  nextSendAt: string | null;
  steps: number;
  approvalId: number | null;
  createdAt: string;
};

export async function listCampaignItems(workspaceId: number): Promise<CampaignListItem[]> {
  const rows = await sql`
    select c.id, c.name, c.status, c.send_model, c.total_leads, c.blocked_count, c.replied_count, c.approval_id, c.created_at,
      (select count(*)::int from campaign_sends s where s.campaign_id = c.id and s.workspace_id = c.workspace_id and s.status = 'sent') as sent,
      (select min(s.scheduled_at) from campaign_sends s where s.campaign_id = c.id and s.workspace_id = c.workspace_id and s.status = 'pending') as next_send,
      (select count(*)::int from campaign_steps st where st.campaign_id = c.id) as steps
    from campaigns c where c.workspace_id = ${workspaceId}
    order by c.created_at desc
  `;
  return rows.map((r) => ({
    id: Number(r.id), name: String(r.name), status: String(r.status) as CampaignStatus, sendModel: String(r.send_model) as SendModel,
    audienceSize: Number(r.total_leads), excluded: Number(r.blocked_count), sent: Number(r.sent),
    replied: Number(r.replied_count) > 0 ? Number(r.replied_count) : null,
    nextSendAt: r.next_send && (r.status === "running" || r.status === "paused") ? new Date(String(r.next_send)).toISOString() : null,
    steps: Number(r.steps), approvalId: r.approval_id === null ? null : Number(r.approval_id), createdAt: new Date(String(r.created_at)).toISOString(),
  }));
}

export type CampaignLeadRow = {
  leadId: number;
  name: string;
  email: string | null;
  status: string;
  currentStep: number;
  nextActionAt: string | null;
  stopReason: string | null;
  sent: number;
};

export type CampaignDetail = {
  campaign: CampaignRecord;
  approval: { id: number; status: string; requestedBy: string | null; decidedBy: string | null; decidedAt: string | null; note: string | null; payload: Record<string, unknown> } | null;
  leadCounts: Record<string, number>;
  leads: CampaignLeadRow[];
  sendCounts: Record<string, number>;
  nextSendAt: string | null;
  lockedStepIds: number[];
  activity: { id: number; at: string; summary: string; actor: string | null }[];
};

export async function getCampaignDetail(workspaceId: number, id: number, opts: { status?: string; limit?: number } = {}): Promise<CampaignDetail> {
  const campaign = await loadCampaign(workspaceId, id);
  const limit = Math.min(opts.limit ?? 200, 500);
  const [approvalRows, countRows, leadRows, sendRows, nextRows, lockedRows, activityRows] = await Promise.all([
    campaign.approvalId
      ? sql`select a.id, a.status, a.decided_at, a.decision_note, a.payload, ru.name as requested_by, du.name as decided_by
            from approvals a left join users ru on ru.id = a.requested_by_user_id left join users du on du.id = a.decided_by_user_id
            where a.id = ${campaign.approvalId} and a.workspace_id = ${workspaceId}`
      : Promise.resolve([] as Record<string, unknown>[]),
    sql`select status, count(*)::int as n from campaign_leads where campaign_id = ${id} and workspace_id = ${workspaceId} group by status`,
    campaign.sendModel === "leads"
      ? sql`
          select cl.lead_id, l.full_name, l.email, cl.status, cl.current_step, cl.next_action_at, cl.stop_reason,
            (select count(*)::int from campaign_sends s where s.campaign_lead_id = cl.id and s.status = 'sent') as sent
          from campaign_leads cl join leads l on l.id = cl.lead_id and l.workspace_id = cl.workspace_id
          where cl.campaign_id = ${id} and cl.workspace_id = ${workspaceId} and (${opts.status ?? null}::text is null or cl.status = ${opts.status ?? null})
          order by case cl.status when 'active' then 0 when 'pending' then 1 else 2 end, cl.next_action_at nulls last, cl.id
          limit ${limit}`
      : // Legacy campaigns have no per-lead state table: derive it from their sends.
        sql`
          select s.lead_id, l.full_name, l.email,
            case when bool_or(s.status = 'pending') then 'active' when bool_or(s.status = 'blocked') then 'blocked' else 'completed' end as status,
            count(*) filter (where s.status = 'sent')::int as current_step, min(s.scheduled_at) filter (where s.status = 'pending') as next_action_at,
            max(s.error_message) filter (where s.status in ('blocked', 'failed')) as stop_reason, count(*) filter (where s.status = 'sent')::int as sent
          from campaign_sends s join leads l on l.id = s.lead_id and l.workspace_id = s.workspace_id
          where s.campaign_id = ${id} and s.workspace_id = ${workspaceId}
          group by s.lead_id, l.full_name, l.email order by min(s.id) limit ${limit}`,
    sql`select status, count(*)::int as n from campaign_sends where campaign_id = ${id} and workspace_id = ${workspaceId} group by status`,
    sql`select min(scheduled_at) as at from campaign_sends where campaign_id = ${id} and workspace_id = ${workspaceId} and status = 'pending'`,
    sql`select distinct step_id from campaign_sends where campaign_id = ${id} and workspace_id = ${workspaceId} and status in ('sent', 'queued')`,
    sql`select a.id, a.created_at, a.summary, u.name from activities a left join users u on u.id = a.actor_user_id
        where a.workspace_id = ${workspaceId} and a.entity_type = 'campaign' and a.entity_id = ${id} order by a.id desc limit 30`,
  ]);
  const a = approvalRows[0];
  const tally = (rows: Record<string, unknown>[]) => Object.fromEntries(rows.map((r) => [String(r.status), Number(r.n)]));
  return {
    campaign,
    approval: a
      ? { id: Number(a.id), status: String(a.status), requestedBy: (a.requested_by as string | null) ?? null, decidedBy: (a.decided_by as string | null) ?? null,
          decidedAt: a.decided_at ? new Date(String(a.decided_at)).toISOString() : null, note: (a.decision_note as string | null) ?? null, payload: (a.payload ?? {}) as Record<string, unknown> }
      : null,
    leadCounts: tally(countRows),
    leads: leadRows.map((r) => ({
      leadId: Number(r.lead_id), name: String(r.full_name), email: (r.email as string | null) ?? null, status: String(r.status),
      currentStep: Number(r.current_step), nextActionAt: r.next_action_at ? new Date(String(r.next_action_at)).toISOString() : null,
      stopReason: (r.stop_reason as string | null) ?? null, sent: Number(r.sent),
    })),
    sendCounts: tally(sendRows),
    nextSendAt: nextRows[0]?.at && (campaign.status === "running" || campaign.status === "paused") ? new Date(String(nextRows[0].at)).toISOString() : null,
    lockedStepIds: lockedRows.map((r) => Number(r.step_id)),
    activity: activityRows.map((r) => ({ id: Number(r.id), at: new Date(String(r.created_at)).toISOString(), summary: String(r.summary), actor: (r.name as string | null) ?? null })),
  };
}
