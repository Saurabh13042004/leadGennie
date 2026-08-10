"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { filterCompliantLeads } from "@/lib/compliance";
import { createApprovalRequest } from "@/lib/approvals-core";
import { logActivity } from "@/lib/activity";
import { personalize } from "@/lib/campaigns/personalize";
import {
  fetchAllLeads,
  fetchMatchingLeads,
  hasStructuredCriteria,
  type FilterCriteria,
  type MatchedLead,
} from "@/lib/db/lead-matching";

const MAX_CAMPAIGN_LEADS = 500;

export type CampaignStatus = "pending_approval" | "running" | "paused" | "rejected";

export type Campaign = {
  id: number;
  name: string;
  status: CampaignStatus;
  audience_label: string | null;
  channels: string[];
  total_leads: number;
  blocked_count: number;
  sent_count: number;
  replied_count: number;
  reply_rate: number;
  approval_id: number | null;
  created_at: string;
};

export async function listCampaigns(): Promise<Campaign[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select
      id, name, status, audience_label, channels,
      total_leads, blocked_count, sent_count, replied_count, approval_id,
      case when sent_count > 0 then round((replied_count::numeric / sent_count) * 100, 1) else 0 end as reply_rate,
      created_at
    from campaigns
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;
  return rows as Campaign[];
}

export type SegmentOption = {
  id: number;
  name: string;
  lead_count: number;
  created_at: string;
};

export async function listSegments(): Promise<SegmentOption[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, name, lead_count, created_at
    from segments
    where workspace_id = ${workspaceId}
    order by created_at desc
    limit 20
  `;
  return rows as SegmentOption[];
}

export type AudienceOption = {
  id: number | null;
  name: string;
  leadCount: number;
  updatedLabel: string;
  prompt: string | null;
};

export async function listAudienceOptions(): Promise<AudienceOption[]> {
  const { workspaceId } = await requireRole("viewer");

  const segmentRows = await sql`
    select id, name, lead_count, prompt, created_at
    from segments
    where workspace_id = ${workspaceId}
    order by created_at desc
    limit 20
  `;

  const totalRows = await sql`
    select count(*)::int as count from leads where workspace_id = ${workspaceId}
  `;
  const totalLeads = (totalRows[0]?.count as number) ?? 0;

  const segments: AudienceOption[] = (
    segmentRows as (SegmentOption & { prompt: string | null })[]
  ).map((s) => ({
    id: s.id,
    name: s.name,
    leadCount: s.lead_count,
    updatedLabel: "saved segment",
    prompt: s.prompt,
  }));

  return [
    ...segments,
    {
      id: null,
      name: "All qualified leads",
      leadCount: totalLeads,
      updatedLabel: "live count",
      prompt: null,
    },
  ];
}

async function resolveLeadsForAudience(
  workspaceId: number,
  audienceSegmentId: number | null
): Promise<MatchedLead[]> {
  if (audienceSegmentId === null) {
    return fetchAllLeads(workspaceId, MAX_CAMPAIGN_LEADS);
  }

  const rows = await sql`
    select criteria from segments where id = ${audienceSegmentId} and workspace_id = ${workspaceId}
  `;
  const criteria = rows[0]?.criteria as FilterCriteria | undefined;

  if (!criteria || !hasStructuredCriteria(criteria)) {
    return fetchAllLeads(workspaceId, MAX_CAMPAIGN_LEADS);
  }

  const matched = await fetchMatchingLeads(workspaceId, criteria, MAX_CAMPAIGN_LEADS);
  return matched.length > 0 ? matched : fetchAllLeads(workspaceId, MAX_CAMPAIGN_LEADS);
}

export type CampaignStepInput = {
  channel: string;
  waitDays: number;
  subject?: string;
  body: string;
};

export type CreateCampaignInput = {
  name: string;
  audienceLabel: string;
  audienceSegmentId: number | null;
  totalLeads: number;
  channels: string[];
  mailboxId: number;
  dailyEmailLimit: number;
  dailyDmLimit: number;
  steps: CampaignStepInput[];
  workflowId?: number | null;
};

/**
 * CAM-01: launching outreach always requires owner/admin approval with an
 * audience diff and sample output — so this creates the campaign + its steps
 * in `pending_approval`, but never schedules a single send. Sends are only
 * created once an admin/owner approves (see lib/actions/approvals.ts).
 */
export async function createCampaign(input: CreateCampaignInput) {
  const { workspaceId, email: owner, userId } = await requireRole("member");

  // DEL-01: no email send may be tied to an unverified/unapproved identity —
  // the mailbox must be active and its domain currently verified.
  const mailboxRows = await sql`
    select m.email, m.status as mailbox_status, d.status as domain_status
    from mailboxes m join domains d on d.id = m.domain_id
    where m.id = ${input.mailboxId} and m.workspace_id = ${workspaceId}
  `;
  const mailbox = mailboxRows[0];
  if (!mailbox) throw new Error("Mailbox not found in this workspace.");
  if (mailbox.mailbox_status !== "active" || mailbox.domain_status !== "verified") {
    throw new Error("This mailbox isn't active on a verified domain — pick a different one.");
  }
  const fromEmail = mailbox.email as string;

  const resolvedLeads = await resolveLeadsForAudience(workspaceId, input.audienceSegmentId);
  const { allowed: leads, blocked } = await filterCompliantLeads(workspaceId, resolvedLeads);

  const inserted = await sql`
    insert into campaigns (
      workspace_id, owner_email, name, status, audience_label, audience_segment_id,
      channels, from_email, mailbox_id, daily_email_limit, daily_dm_limit, total_leads, blocked_count, workflow_id
    )
    values (
      ${workspaceId}, ${owner}, ${input.name}, 'pending_approval', ${input.audienceLabel}, ${input.audienceSegmentId},
      ${input.channels}, ${fromEmail}, ${input.mailboxId}, ${input.dailyEmailLimit}, ${input.dailyDmLimit}, ${leads.length}, ${blocked.length}, ${input.workflowId ?? null}
    )
    returning id
  `;
  const campaignId = inserted[0].id as number;

  let firstStep: { channel: string; subject: string | null; body: string } | null = null;
  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];
    await sql`
      insert into campaign_steps (campaign_id, step_order, channel, wait_days, subject, body)
      values (${campaignId}, ${i + 1}, ${step.channel}, ${step.waitDays}, ${step.subject ?? null}, ${step.body})
    `;
    if (i === 0) firstStep = { channel: step.channel, subject: step.subject ?? null, body: step.body };
  }

  const sampleLead = leads[0];
  const sampleMessage =
    firstStep && sampleLead
      ? {
          subject: firstStep.subject ? personalize(firstStep.subject, sampleLead) : null,
          body: personalize(firstStep.body, sampleLead),
          leadName: sampleLead.full_name,
        }
      : null;

  const blockedReasons = {
    do_not_contact: blocked.filter((b) => b.reason === "do_not_contact").length,
    cooldown: blocked.filter((b) => b.reason === "cooldown").length,
  };

  const approvalId = await createApprovalRequest({
    workspaceId,
    type: "campaign_launch",
    entityType: "campaign",
    entityId: campaignId,
    title: `Launch "${input.name}"`,
    summary: `${leads.length} lead${leads.length === 1 ? "" : "s"} via ${input.channels.join(" + ")}${
      blocked.length > 0 ? ` — ${blocked.length} excluded by compliance rules` : ""
    }`,
    payload: {
      audienceLabel: input.audienceLabel,
      totalLeads: leads.length,
      blockedCount: blocked.length,
      blockedReasons,
      channels: input.channels,
      sampleMessage,
      leadIds: leads.map((l) => l.id),
    },
    requestedByUserId: userId,
  });

  await sql`update campaigns set approval_id = ${approvalId} where id = ${campaignId}`;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "campaign.launch_requested",
    entityType: "campaign",
    entityId: campaignId,
    summary: `Requested approval to launch "${input.name}" to ${leads.length} leads`,
  });

  revalidatePath("/dashboard/campaigns");
  return {
    id: campaignId,
    status: "pending_approval" as const,
    leadCount: leads.length,
    blockedCount: blocked.length,
    blockedReasons,
    approvalId,
  };
}

export async function updateCampaignStatus(id: number, status: "running" | "paused") {
  const { workspaceId } = await requireRole("member");
  // Resuming/pausing only applies to already-approved campaigns — jumping
  // straight from pending_approval or rejected to running must go through
  // the approval flow, never this shortcut.
  const fromStatus = status === "running" ? "paused" : "running";
  await sql`
    update campaigns
    set status = ${status}
    where id = ${id} and workspace_id = ${workspaceId} and status = ${fromStatus}
  `;
  revalidatePath("/dashboard/campaigns");
}
