import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const workspaceId = 1;
const owner = "demo@leadgennie.ai";

// Resolve "all leads" audience
const leads = await sql`select id, full_name, email, company from leads where workspace_id = ${workspaceId} order by created_at desc limit 500`;

// Filter compliant (mirrors lib/compliance.ts filterCompliantLeads)
const dncRows = await sql`select lower(email) as email from do_not_contact where workspace_id = ${workspaceId}`;
const dncSet = new Set(dncRows.map(r => r.email));
const allowed = leads.filter(l => !(l.email && dncSet.has(l.email.toLowerCase())));
const blocked = leads.filter(l => l.email && dncSet.has(l.email.toLowerCase()));

console.log(`Resolved ${leads.length} leads -> ${allowed.length} allowed, ${blocked.length} blocked`);

// Insert campaign exactly as createCampaign does
const [campaign] = await sql`
  insert into campaigns (workspace_id, owner_email, name, status, audience_label, channels, from_email, daily_email_limit, daily_dm_limit, total_leads, blocked_count)
  values (${workspaceId}, ${owner}, 'DNC Compliance Test Campaign', 'running', 'All qualified leads', ${['email']}, 'test@leadgennie.ai', 80, 25, ${allowed.length}, ${blocked.length})
  returning id, total_leads, blocked_count
`;
console.log("Created campaign:", campaign);

const [step] = await sql`
  insert into campaign_steps (campaign_id, step_order, channel, wait_days, subject, body)
  values (${campaign.id}, 1, 'email', 0, 'Test subject', 'Hi {{first_name}}')
  returning id
`;

if (allowed.length > 0) {
  const leadIds = allowed.map(l => l.id);
  await sql.query(
    `insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, scheduled_at, subject, body)
     select * from unnest($1::bigint[], $2::bigint[], $3::bigint[], $4::bigint[], $5::text[], $6::timestamptz[], $7::text[], $8::text[])`,
    [
      leadIds.map(() => workspaceId),
      leadIds.map(() => campaign.id),
      leadIds,
      leadIds.map(() => step.id),
      leadIds.map(() => 'email'),
      leadIds.map(() => new Date().toISOString()),
      leadIds.map(() => 'Test subject'),
      leadIds.map(() => 'Hi {{first_name}}'),
    ]
  );
}

const sendsCreated = await sql`select lead_id from campaign_sends where campaign_id = ${campaign.id}`;
console.log("campaign_sends created for lead_ids:", sendsCreated.map(r => r.lead_id));
console.log("Expected: only allowed lead ids, NOT jane's id (1)");
