"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import {
  fetchAllLeads,
  fetchMatchingLeads,
  hasStructuredCriteria,
  type FilterCriteria,
  type MatchedLead,
} from "@/lib/db/lead-matching";

const MAX_CAMPAIGN_LEADS = 500;

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

export type CampaignStatus = "draft" | "running" | "paused";

export type Campaign = {
  id: number;
  name: string;
  status: CampaignStatus;
  audience_label: string | null;
  channels: string[];
  total_leads: number;
  sent_count: number;
  replied_count: number;
  reply_rate: number;
  created_at: string;
};

export async function listCampaigns(): Promise<Campaign[]> {
  const owner = await requireOwnerEmail();
  const rows = await sql`
    select
      id, name, status, audience_label, channels,
      total_leads, sent_count, replied_count,
      case when sent_count > 0 then round((replied_count::numeric / sent_count) * 100, 1) else 0 end as reply_rate,
      created_at
    from campaigns
    where owner_email = ${owner}
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
  const owner = await requireOwnerEmail();
  const rows = await sql`
    select id, name, lead_count, created_at
    from segments
    where owner_email = ${owner}
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
  const owner = await requireOwnerEmail();

  const segmentRows = await sql`
    select id, name, lead_count, prompt, created_at
    from segments
    where owner_email = ${owner}
    order by created_at desc
    limit 20
  `;

  const totalRows = await sql`
    select count(*)::int as count from leads where owner_email = ${owner}
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
  owner: string,
  audienceSegmentId: number | null
): Promise<MatchedLead[]> {
  if (audienceSegmentId === null) {
    return fetchAllLeads(owner, MAX_CAMPAIGN_LEADS);
  }

  const rows = await sql`
    select criteria from segments where id = ${audienceSegmentId} and owner_email = ${owner}
  `;
  const criteria = rows[0]?.criteria as FilterCriteria | undefined;

  if (!criteria || !hasStructuredCriteria(criteria)) {
    return fetchAllLeads(owner, MAX_CAMPAIGN_LEADS);
  }

  const matched = await fetchMatchingLeads(owner, criteria, MAX_CAMPAIGN_LEADS);
  return matched.length > 0 ? matched : fetchAllLeads(owner, MAX_CAMPAIGN_LEADS);
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
  fromEmail: string;
  dailyEmailLimit: number;
  dailyDmLimit: number;
  steps: CampaignStepInput[];
};

export async function createCampaign(input: CreateCampaignInput) {
  const owner = await requireOwnerEmail();

  const leads = await resolveLeadsForAudience(owner, input.audienceSegmentId);

  const inserted = await sql`
    insert into campaigns (
      owner_email, name, status, audience_label, audience_segment_id,
      channels, from_email, daily_email_limit, daily_dm_limit, total_leads
    )
    values (
      ${owner}, ${input.name}, 'running', ${input.audienceLabel}, ${input.audienceSegmentId},
      ${input.channels}, ${input.fromEmail}, ${input.dailyEmailLimit}, ${input.dailyDmLimit}, ${leads.length}
    )
    returning id
  `;
  const campaignId = inserted[0].id as number;

  let cumulativeDays = 0;
  const stepSchedules: {
    id: number;
    channel: string;
    subject: string | null;
    body: string;
    scheduledAt: string;
  }[] = [];

  for (let i = 0; i < input.steps.length; i++) {
    const step = input.steps[i];
    cumulativeDays += step.waitDays;
    const stepInserted = await sql`
      insert into campaign_steps (campaign_id, step_order, channel, wait_days, subject, body)
      values (${campaignId}, ${i + 1}, ${step.channel}, ${step.waitDays}, ${step.subject ?? null}, ${step.body})
      returning id
    `;
    const scheduledAt = new Date(Date.now() + cumulativeDays * 24 * 60 * 60 * 1000);
    stepSchedules.push({
      id: stepInserted[0].id as number,
      channel: step.channel,
      subject: step.subject ?? null,
      body: step.body,
      scheduledAt: scheduledAt.toISOString(),
    });
  }

  if (leads.length > 0) {
    const leadIds = leads.map((l) => l.id);
    for (const step of stepSchedules) {
      const campaignIds = leadIds.map(() => campaignId);
      const stepIds = leadIds.map(() => step.id);
      const channels = leadIds.map(() => step.channel);
      const scheduledAts = leadIds.map(() => step.scheduledAt);
      const subjects = leadIds.map(() => step.subject);
      const bodies = leadIds.map(() => step.body);

      await sql.query(
        `insert into campaign_sends (campaign_id, lead_id, step_id, channel, scheduled_at, subject, body)
         select * from unnest($1::bigint[], $2::bigint[], $3::bigint[], $4::text[], $5::timestamptz[], $6::text[], $7::text[])`,
        [campaignIds, leadIds, stepIds, channels, scheduledAts, subjects, bodies]
      );
    }
  }

  revalidatePath("/dashboard/campaigns");
  return { id: campaignId, leadCount: leads.length };
}

export async function updateCampaignStatus(id: number, status: CampaignStatus) {
  const owner = await requireOwnerEmail();
  await sql`
    update campaigns
    set status = ${status}
    where id = ${id} and owner_email = ${owner}
  `;
  revalidatePath("/dashboard/campaigns");
}
