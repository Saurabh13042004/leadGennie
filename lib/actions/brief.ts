"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";

export type FailedSendGroup = {
  campaignId: number;
  campaignName: string;
  errorMessage: string;
  count: number;
  sendIds: number[];
};

export type BlockedSendGroup = {
  campaignId: number;
  campaignName: string;
  reason: string;
  count: number;
};

export type PendingApprovalSummary = {
  id: number;
  title: string;
  summary: string | null;
  createdAt: string;
};

export type TodaysBrief = {
  failedGroups: FailedSendGroup[];
  failedTotal: number;
  blockedGroups: BlockedSendGroup[];
  blockedTotal: number;
  overdueCount: number;
  dncTotal: number;
  pendingApprovals: PendingApprovalSummary[];
  tasksToday: number;
  tasksOverdue: number;
};

export async function getTodaysBrief(): Promise<TodaysBrief> {
  const { workspaceId } = await requireRole("viewer");

  const [failedRows, blockedRows, overdueRows, dncRows, approvalRows, taskRows] = await Promise.all([
    sql`
      select
        cs.campaign_id, c.name as campaign_name, cs.error_message,
        count(*)::int as count,
        array_agg(cs.id order by cs.id) as send_ids
      from campaign_sends cs
      join campaigns c on c.id = cs.campaign_id
      where cs.workspace_id = ${workspaceId} and cs.status = 'failed'
      group by cs.campaign_id, c.name, cs.error_message
      order by count(*) desc
      limit 20
    `,
    sql`
      select
        cs.campaign_id, c.name as campaign_name, cs.error_message,
        count(*)::int as count
      from campaign_sends cs
      join campaigns c on c.id = cs.campaign_id
      where cs.workspace_id = ${workspaceId} and cs.status = 'blocked'
      group by cs.campaign_id, c.name, cs.error_message
      order by count(*) desc
      limit 20
    `,
    sql`
      select count(*)::int as count
      from campaign_sends
      where workspace_id = ${workspaceId} and status = 'pending' and scheduled_at < now() - interval '1 hour'
    `,
    sql`select count(*)::int as count from do_not_contact where workspace_id = ${workspaceId}`,
    sql`
      select id, title, summary, created_at from approvals
      where workspace_id = ${workspaceId} and status = 'pending'
      order by created_at asc
      limit 20
    `,
    sql`
      select
        count(*) filter (where due_at::date = current_date) as today,
        count(*) filter (where due_at is not null and due_at < now()) as overdue
      from tasks
      where workspace_id = ${workspaceId} and status = 'open'
    `,
  ]);

  const failedGroups: FailedSendGroup[] = failedRows.map((r) => ({
    campaignId: r.campaign_id as number,
    campaignName: r.campaign_name as string,
    errorMessage: (r.error_message as string) ?? "Unknown error",
    count: r.count as number,
    sendIds: r.send_ids as number[],
  }));

  const blockedGroups: BlockedSendGroup[] = blockedRows.map((r) => ({
    campaignId: r.campaign_id as number,
    campaignName: r.campaign_name as string,
    reason: (r.error_message as string) ?? "Blocked",
    count: r.count as number,
  }));

  const pendingApprovals: PendingApprovalSummary[] = approvalRows.map((r) => ({
    id: r.id as number,
    title: r.title as string,
    summary: r.summary as string | null,
    createdAt: r.created_at as string,
  }));

  return {
    failedGroups,
    failedTotal: failedGroups.reduce((acc, g) => acc + g.count, 0),
    blockedGroups,
    blockedTotal: blockedGroups.reduce((acc, g) => acc + g.count, 0),
    overdueCount: (overdueRows[0]?.count as number) ?? 0,
    dncTotal: (dncRows[0]?.count as number) ?? 0,
    pendingApprovals,
    tasksToday: Number(taskRows[0]?.today ?? 0),
    tasksOverdue: Number(taskRows[0]?.overdue ?? 0),
  };
}

/** Resolution path for DAS-03: requeue an entire failed group for retry. */
export async function retryFailedGroup(campaignId: number, sendIds: number[]) {
  const { workspaceId } = await requireRole("member");
  if (sendIds.length === 0) return;

  await sql.query(
    `update campaign_sends
     set status = 'pending', error_message = null, scheduled_at = now()
     where workspace_id = $1 and campaign_id = $2 and id = any($3::bigint[]) and status = 'failed'`,
    [workspaceId, campaignId, sendIds]
  );

  revalidatePath("/dashboard/brief");
}
