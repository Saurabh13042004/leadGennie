"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { filterCompliantLeads } from "@/lib/compliance";
import { getCampaignSteps, scheduleCampaignSends } from "@/lib/campaigns/scheduling";
import type { ApprovalStatus, ApprovalType } from "@/lib/approvals-core";

export type Approval = {
  id: number;
  type: ApprovalType;
  status: ApprovalStatus;
  entityType: string;
  entityId: number;
  title: string;
  summary: string | null;
  payload: Record<string, unknown>;
  requestedByName: string | null;
  decidedByName: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export async function listApprovals(status?: ApprovalStatus): Promise<Approval[]> {
  const { workspaceId } = await requireRole("viewer");

  const rows = status
    ? await sql`
        select
          a.id, a.type, a.status, a.entity_type, a.entity_id, a.title, a.summary, a.payload,
          a.decision_note, a.created_at, a.decided_at,
          ru.name as requested_by_name, du.name as decided_by_name
        from approvals a
        left join users ru on ru.id = a.requested_by_user_id
        left join users du on du.id = a.decided_by_user_id
        where a.workspace_id = ${workspaceId} and a.status = ${status}
        order by a.created_at desc
      `
    : await sql`
        select
          a.id, a.type, a.status, a.entity_type, a.entity_id, a.title, a.summary, a.payload,
          a.decision_note, a.created_at, a.decided_at,
          ru.name as requested_by_name, du.name as decided_by_name
        from approvals a
        left join users ru on ru.id = a.requested_by_user_id
        left join users du on du.id = a.decided_by_user_id
        where a.workspace_id = ${workspaceId}
        order by a.created_at desc
        limit 50
      `;

  return rows.map((r) => ({
    id: r.id as number,
    type: r.type as ApprovalType,
    status: r.status as ApprovalStatus,
    entityType: r.entity_type as string,
    entityId: r.entity_id as number,
    title: r.title as string,
    summary: r.summary as string | null,
    payload: r.payload as Record<string, unknown>,
    requestedByName: r.requested_by_name as string | null,
    decidedByName: r.decided_by_name as string | null,
    decisionNote: r.decision_note as string | null,
    createdAt: r.created_at as string,
    decidedAt: r.decided_at as string | null,
  }));
}

/** CAM-01: only owner/admin can decide — enforced by requireRole, not just UI. */
export async function decideApproval(approvalId: number, decision: "approved" | "rejected", note?: string) {
  const { workspaceId, userId } = await requireRole("admin");

  const rows = await sql`
    select id, type, entity_type, entity_id, payload, title
    from approvals
    where id = ${approvalId} and workspace_id = ${workspaceId} and status = 'pending'
  `;
  const approval = rows[0];
  if (!approval) throw new Error("Approval not found or already decided");

  await sql`
    update approvals
    set status = ${decision}, decided_by_user_id = ${userId}, decided_at = now(), decision_note = ${note?.trim() || null}
    where id = ${approvalId}
  `;

  if (approval.type === "campaign_launch") {
    const campaignId = approval.entity_id as number;

    if (decision === "rejected") {
      await sql`update campaigns set status = 'rejected' where id = ${campaignId} and workspace_id = ${workspaceId}`;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.rejected",
        entityType: "campaign",
        entityId: campaignId,
        summary: `Rejected launch: ${approval.title}${note ? ` — ${note}` : ""}`,
      });
    } else {
      const payload = approval.payload as { leadIds: number[] };
      const candidateIds = payload.leadIds ?? [];

      // Defense-in-depth: re-check compliance now, not just at request time —
      // time may have passed and someone could have been suppressed since.
      const candidateLeads =
        candidateIds.length > 0
          ? ((await sql.query(
              `select id, email from leads where workspace_id = $1 and id = any($2::bigint[])`,
              [workspaceId, candidateIds]
            )) as { id: number; email: string | null }[])
          : [];
      const { allowed, blocked: newlyBlocked } = await filterCompliantLeads(workspaceId, candidateLeads);

      const steps = await getCampaignSteps(campaignId);
      await scheduleCampaignSends(
        workspaceId,
        campaignId,
        allowed.map((l) => l.id),
        steps
      );

      await sql`
        update campaigns
        set status = 'running', total_leads = ${allowed.length}, blocked_count = blocked_count + ${newlyBlocked.length}
        where id = ${campaignId} and workspace_id = ${workspaceId}
      `;

      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "campaign",
        entityId: campaignId,
        summary: `Approved launch: ${approval.title} (${allowed.length} leads scheduled)`,
        metadata: { newlyBlockedAtApproval: newlyBlocked.length },
      });
    }
  }

  if (approval.type === "prompt_publish") {
    const versionId = approval.entity_id as number;
    const payload = approval.payload as { promptId: number };

    if (decision === "rejected") {
      await sql`update prompt_versions set status = 'draft' where id = ${versionId} and workspace_id = ${workspaceId}`;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.rejected",
        entityType: "prompt_version",
        entityId: versionId,
        summary: `Rejected: ${approval.title}${note ? ` — ${note}` : ""} (back to draft)`,
      });
    } else {
      // AI-01: publishing pins this version and retires whichever version was
      // previously the pinned one — exactly one published version per prompt.
      await sql`
        update prompt_versions set status = 'deprecated', deprecated_at = now()
        where prompt_id = ${payload.promptId} and workspace_id = ${workspaceId} and status = 'published'
      `;
      await sql`
        update prompt_versions
        set status = 'published', published_at = now(), approved_by_user_id = ${userId}
        where id = ${versionId} and workspace_id = ${workspaceId}
      `;

      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "prompt_version",
        entityId: versionId,
        summary: `Approved and published: ${approval.title}`,
      });
    }
    revalidatePath("/dashboard/ai-prompts");
  }

  if (approval.type === "mailbox_add") {
    const mailboxId = approval.entity_id as number;

    if (decision === "rejected") {
      await sql`delete from mailboxes where id = ${mailboxId} and workspace_id = ${workspaceId}`;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.rejected",
        entityType: "mailbox",
        entityId: mailboxId,
        summary: `Rejected: ${approval.title}${note ? ` — ${note}` : ""}`,
      });
    } else {
      await sql`
        update mailboxes set status = 'active' where id = ${mailboxId} and workspace_id = ${workspaceId}
      `;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "mailbox",
        entityId: mailboxId,
        summary: `Approved and activated: ${approval.title}`,
      });
    }
    revalidatePath("/dashboard/deliverability");
  }

  if (approval.type === "mailbox_limit_change") {
    const mailboxId = approval.entity_id as number;
    const payload = approval.payload as { newLimit: number };

    if (decision === "rejected") {
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.rejected",
        entityType: "mailbox",
        entityId: mailboxId,
        summary: `Rejected: ${approval.title}${note ? ` — ${note}` : ""}`,
      });
    } else {
      await sql`
        update mailboxes set daily_limit = ${payload.newLimit}
        where id = ${mailboxId} and workspace_id = ${workspaceId} and status = 'active'
      `;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "mailbox",
        entityId: mailboxId,
        summary: `Approved: ${approval.title}`,
      });
    }
    revalidatePath("/dashboard/deliverability");
  }

  if (approval.type === "form_lead_proposal") {
    const submissionId = approval.entity_id as number;
    const payload = approval.payload as {
      action: "create" | "update";
      submissionId: number;
      leadId?: number;
      fields: Record<string, string>;
      owner?: string;
    };

    if (decision === "rejected") {
      await sql`update form_submissions set status = 'ignored' where id = ${submissionId} and workspace_id = ${workspaceId}`;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.rejected",
        entityType: "form_submission",
        entityId: submissionId,
        summary: `Rejected: ${approval.title}${note ? ` — ${note}` : ""}`,
      });
    } else if (payload.action === "create") {
      const f = payload.fields;
      const leadRows = await sql`
        insert into leads (workspace_id, owner_email, full_name, email, company, source)
        values (${workspaceId}, ${payload.owner ?? "unknown@workspace"}, ${f.full_name || f.email || "Unknown"}, ${f.email ?? null}, ${f.company ?? null}, 'form')
        returning id
      `;
      const leadId = leadRows[0].id as number;
      await sql`
        update form_submissions set status = 'resolved', matched_lead_id = ${leadId}
        where id = ${submissionId} and workspace_id = ${workspaceId}
      `;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "lead",
        entityId: leadId,
        summary: `Approved: ${approval.title}`,
      });
    } else if (payload.action === "update" && payload.leadId) {
      const f = payload.fields;
      await sql`
        update leads set
          company = coalesce(${f.company ?? null}, company),
          job_title = coalesce(${f.job_title ?? null}, job_title)
        where id = ${payload.leadId} and workspace_id = ${workspaceId}
      `;
      await sql`
        update form_submissions set status = 'resolved' where id = ${submissionId} and workspace_id = ${workspaceId}
      `;
      await logActivity({
        workspaceId,
        actorUserId: userId,
        type: "approval.approved",
        entityType: "lead",
        entityId: payload.leadId,
        summary: `Approved: ${approval.title}`,
      });
    }
    revalidatePath("/dashboard/inbox");
    revalidatePath("/dashboard/leads");
  }

  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/brief");
}
