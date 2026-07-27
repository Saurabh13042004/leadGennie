import { sql } from "@/lib/db/client";

export type CampaignStepRow = {
  id: number;
  channel: string;
  wait_days: number;
  subject: string | null;
  body: string;
};

export async function getCampaignSteps(campaignId: number): Promise<CampaignStepRow[]> {
  const rows = await sql`
    select id, channel, wait_days, subject, body
    from campaign_steps
    where campaign_id = ${campaignId}
    order by step_order asc
  `;
  return rows as CampaignStepRow[];
}

/** Creates the campaign_sends schedule for a set of leads across every step, starting from now. */
export async function scheduleCampaignSends(
  workspaceId: number,
  campaignId: number,
  leadIds: number[],
  steps: CampaignStepRow[]
) {
  if (leadIds.length === 0 || steps.length === 0) return;

  let cumulativeDays = 0;
  for (const step of steps) {
    cumulativeDays += step.wait_days;
    const scheduledAt = new Date(Date.now() + cumulativeDays * 24 * 60 * 60 * 1000).toISOString();

    const workspaceIds = leadIds.map(() => workspaceId);
    const campaignIds = leadIds.map(() => campaignId);
    const stepIds = leadIds.map(() => step.id);
    const channels = leadIds.map(() => step.channel);
    const scheduledAts = leadIds.map(() => scheduledAt);
    const subjects = leadIds.map(() => step.subject);
    const bodies = leadIds.map(() => step.body);

    await sql.query(
      `insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, scheduled_at, subject, body)
       select * from unnest($1::bigint[], $2::bigint[], $3::bigint[], $4::bigint[], $5::text[], $6::timestamptz[], $7::text[], $8::text[])`,
      [workspaceIds, campaignIds, leadIds, stepIds, channels, scheduledAts, subjects, bodies]
    );
  }
}
