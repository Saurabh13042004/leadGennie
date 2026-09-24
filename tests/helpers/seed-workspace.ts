import { sql } from "./test-db";
import { createWorkspace } from "./factories";

/**
 * One row in every workspace-owned table. Every text field carries the
 * workspace's SENTINEL so a leak into another tenant's result is greppable.
 */
export type SeededWorkspace = Awaited<ReturnType<typeof seedWorkspace>>;

let n = 0;

export async function seedWorkspace(label: string) {
  const { workspaceId, user } = await createWorkspace({ name: `${label} workspace` });
  const S = `SENTINEL-${label}-${++n}`;
  const id = async (q: Promise<Record<string, unknown>[]> | PromiseLike<Record<string, unknown>[]>) =>
    Number((await q)[0].id);

  const leadId = await id(sql`
    insert into leads (workspace_id, full_name, email, company) values (${workspaceId}, ${S}, ${`${S}@example.com`.toLowerCase()}, ${S}) returning id`);
  const segmentId = await id(sql`
    insert into segments (workspace_id, name, prompt) values (${workspaceId}, ${S}, ${S}) returning id`);
  const campaignId = await id(sql`
    insert into campaigns (workspace_id, name, status) values (${workspaceId}, ${S}, 'running') returning id`);
  const stepId = await id(sql`
    insert into campaign_steps (campaign_id, step_order, channel, subject, body) values (${campaignId}, 1, 'email', ${S}, ${S}) returning id`);
  const sendId = await id(sql`
    insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, body)
    values (${workspaceId}, ${campaignId}, ${leadId}, ${stepId}, 'linkedin_dm', 'queued', now(), ${S}) returning id`);
  const approvalId = await id(sql`
    insert into approvals (workspace_id, type, entity_type, entity_id, title)
    values (${workspaceId}, 'campaign_launch', 'campaign', ${campaignId}, ${S}) returning id`);
  const pipelineId = await id(sql`insert into pipelines (workspace_id, name, is_default) values (${workspaceId}, ${S}, true) returning id`);
  const stageId = await id(sql`
    insert into pipeline_stages (pipeline_id, workspace_id, stage_key, name) values (${pipelineId}, ${workspaceId}, 'new', ${S}) returning id`);
  const dealId = await id(sql`
    insert into deals (workspace_id, pipeline_id, stage_id, name) values (${workspaceId}, ${pipelineId}, ${stageId}, ${S}) returning id`);
  const taskId = await id(sql`
    insert into tasks (workspace_id, title, owner_user_id) values (${workspaceId}, ${S}, ${user.id}) returning id`);
  const promptId = await id(sql`
    insert into prompts (workspace_id, name, type) values (${workspaceId}, ${S}, 'sequence_step') returning id`);
  const versionId = await id(sql`
    insert into prompt_versions (prompt_id, workspace_id, version_number, template, model)
    values (${promptId}, ${workspaceId}, 1, ${S}, 'test-model') returning id`);
  const domainId = await id(sql`
    insert into domains (workspace_id, resend_domain_id, name) values (${workspaceId}, ${`rd-${S}`}, ${`${S}.example.com`.toLowerCase()}) returning id`);
  const mailboxId = await id(sql`
    insert into mailboxes (workspace_id, domain_id, email, status) values (${workspaceId}, ${domainId}, ${`${S}@mail.example.com`.toLowerCase()}, 'active') returning id`);
  const formId = await id(sql`
    insert into forms (workspace_id, name, embed_key, consent_text) values (${workspaceId}, ${S}, ${`key-${S}`}, ${S}) returning id`);
  const submissionId = await id(sql`
    insert into form_submissions (workspace_id, form_id, payload, status) values (${workspaceId}, ${formId}, ${JSON.stringify({ email: `${S}@example.com`, note: S })}, 'pending') returning id`);
  const workflowId = await id(sql`insert into workflows (workspace_id, name) values (${workspaceId}, ${S}) returning id`);
  await sql`insert into workflow_steps (workflow_id, step_order, channel, body) values (${workflowId}, 1, 'email', ${S})`;
  const dncId = await id(sql`
    insert into do_not_contact (workspace_id, email, reason) values (${workspaceId}, ${`dnc-${S}@example.com`.toLowerCase()}, ${S}) returning id`);
  const activityId = await id(sql`
    insert into activities (workspace_id, type, entity_type, summary) values (${workspaceId}, 'test', 'lead', ${S}) returning id`);
  const connectionId = await id(sql`
    insert into crm_connections (workspace_id, provider, label, portal_id, access_token, refresh_token, expires_at)
    values (${workspaceId}, 'hubspot', ${S}, ${S}, 'ct', 'ct', now() + interval '1 day') returning id`);
  const token = `lg_${S}`;
  await sql`
    insert into api_tokens (workspace_id, token_hash, token_prefix)
    values (${workspaceId}, encode(sha256(convert_to(${token}, 'UTF8')), 'hex'), ${token.slice(0, 8)})`;
  const [member] = await sql`select id from workspace_members where workspace_id = ${workspaceId}`;

  return {
    label, S, workspaceId, user, token,
    ids: {
      leadId, segmentId, campaignId, stepId, sendId, approvalId, pipelineId, stageId, dealId, taskId,
      promptId, versionId, domainId, mailboxId, formId, submissionId, workflowId, dncId, activityId,
      connectionId, memberId: Number(member.id),
    },
  };
}

const WORKSPACE_TABLES = [
  "leads", "segments", "campaigns", "campaign_sends", "approvals", "pipelines", "pipeline_stages", "deals",
  "tasks", "prompts", "prompt_versions", "domains", "mailboxes", "forms", "form_submissions", "workflows",
  "do_not_contact", "activities", "crm_connections", "api_tokens", "workspace_members", "import_jobs",
  "message_generations",
];

/** Deterministic dump of everything a workspace owns (plus child rows) — compare before/after. */
export async function snapshotWorkspace(workspaceId: number): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const t of WORKSPACE_TABLES) {
    out[t] = await sql.query(`select * from ${t} where workspace_id = $1 order by id`, [workspaceId]);
  }
  out.campaign_steps = await sql.query(
    `select cs.* from campaign_steps cs join campaigns c on c.id = cs.campaign_id where c.workspace_id = $1 order by cs.id`,
    [workspaceId],
  );
  out.workflow_steps = await sql.query(
    `select ws.* from workflow_steps ws join workflows w on w.id = ws.workflow_id where w.workspace_id = $1 order by ws.id`,
    [workspaceId],
  );
  return JSON.stringify(out);
}
