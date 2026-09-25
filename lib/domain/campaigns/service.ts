import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { fillPlaceholders, threadedSubject } from "@/lib/campaigns/render";
import { getWorkspaceTone } from "@/lib/domain/personalization/service";
import { loadCampaign, loadMailbox, loadSentStepIds } from "./repository";
import { assertTransition, isContentEditable, isStructureEditable } from "./state-machine";
import {
  audienceDefinitionSchema,
  basicsSchema,
  DEFAULT_AUDIENCE,
  DEFAULT_SEND_WINDOW,
  DEFAULT_WAIT_DAYS,
  MAX_STEPS,
  stepInputSchema,
  type CampaignRecord,
  type StepInput,
} from "./types";

/**
 * Building and editing campaigns (WP4.1/4.2). THE single writer of campaigns/campaign_steps for builder campaigns.
 * Structure (mailbox, audience, limits, step list) is editable only before approval. Copy of steps that haven't gone
 * out yet stays editable while a campaign runs; editing an approved-but-unlaunched campaign sends it back to draft,
 * because the approval covered the old content.
 */

export type Actor = { workspaceId: number; userId: number | null };

const touch = (workspaceId: number, id: number) => sql`update campaigns set updated_at = now() where id = ${id} and workspace_id = ${workspaceId}`;

async function requireBuilderCampaign(workspaceId: number, id: number): Promise<CampaignRecord> {
  const c = await loadCampaign(workspaceId, id);
  if (c.sendModel !== "leads") throw new AppError("CONFLICT", "This campaign was created with the old wizard and can't be edited in the builder. Pause or cancel it from its page.");
  return c;
}

/** A new builder campaign starts as a draft with the default 4-step cadence (or a saved workflow's email steps). */
export async function createDraftCampaign(actor: Actor, input: { name: string; workflowId?: number | null }): Promise<number> {
  const name = input.name.trim();
  if (!name) throw new AppError("VALIDATION_ERROR", "Give the campaign a name.");
  if (name.length > 120) throw new AppError("VALIDATION_ERROR", "Keep the name under 120 characters.");

  let steps: StepInput[] = DEFAULT_WAIT_DAYS.map((w) => ({ waitDays: w, subject: "", body: "", mode: "template" as const }));
  let audience = DEFAULT_AUDIENCE;
  if (input.workflowId) {
    const wf = await sql`select source_type, source_segment_id from workflows where id = ${input.workflowId} and workspace_id = ${actor.workspaceId}`;
    if (wf.length === 0) throw new AppError("NOT_FOUND", "That workflow no longer exists.");
    const wfSteps = await sql`
      select channel, wait_days, subject, body from workflow_steps where workflow_id = ${input.workflowId} order by step_order`;
    // V1 is email-only (D-05): LinkedIn steps in a workflow template are skipped, and their wait folds into the next email.
    let carry = 0;
    const emails: StepInput[] = [];
    for (const s of wfSteps) {
      if (s.channel !== "email") {
        carry += Number(s.wait_days);
        continue;
      }
      emails.push({ waitDays: Number(s.wait_days) + carry, subject: String(s.subject ?? ""), body: String(s.body ?? ""), mode: "template" });
      carry = 0;
    }
    if (emails.length > 0) steps = emails.slice(0, MAX_STEPS).map((s, i) => (i === 0 ? { ...s, waitDays: 0 } : s));
    if (wf[0].source_type === "segment" && wf[0].source_segment_id) {
      audience = audienceDefinitionSchema.parse({ source: "segment", segmentId: Number(wf[0].source_segment_id) });
    }
  }

  const tone = await getWorkspaceTone(actor.workspaceId);
  const [row] = await sql`
    insert into campaigns (workspace_id, name, status, send_model, channels, daily_email_limit, daily_dm_limit, tone, send_window,
                           audience_definition, audience_label, workflow_id, created_by_user_id)
    values (${actor.workspaceId}, ${name}, 'draft', 'leads', ${["email"]}, 80, 0, ${tone}, ${JSON.stringify(DEFAULT_SEND_WINDOW)},
            ${JSON.stringify(audience)}, ${audience.source === "segment" ? "Saved segment" : "All leads"}, ${input.workflowId ?? null}, ${actor.userId})
    returning id`;
  const id = Number(row.id);
  await writeSteps(id, steps);
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.created", entityType: "campaign", entityId: id, summary: `Created campaign draft "${name}"` });
  return id;
}

async function writeSteps(campaignId: number, steps: StepInput[]) {
  await sql.transaction([
    sql`delete from campaign_steps where campaign_id = ${campaignId}`,
    ...steps.map((s, i) => sql`
      insert into campaign_steps (campaign_id, step_order, channel, wait_days, subject, body, mode)
      values (${campaignId}, ${i + 1}, 'email', ${i === 0 ? 0 : s.waitDays}, ${i === 0 ? s.subject : ""}, ${s.body}, ${i === 0 ? s.mode : "template"})`),
  ]);
}

export async function updateBasics(actor: Actor, id: number, input: unknown): Promise<CampaignRecord> {
  const c = await requireBuilderCampaign(actor.workspaceId, id);
  if (!isStructureEditable(c.status)) throw new AppError("CONFLICT", "Settings can only be changed before the campaign is approved.");
  const b = basicsSchema.parse(input);
  let fromEmail: string | null = null;
  if (b.mailboxId !== null) {
    const mb = await loadMailbox(actor.workspaceId, b.mailboxId);
    if (!mb) throw new AppError("NOT_FOUND", "Mailbox not found in this workspace.");
    if (b.dailyLimit > mb.dailyLimit) {
      throw new AppError("VALIDATION_ERROR", `The daily limit can't be higher than ${mb.email}'s limit of ${mb.dailyLimit}/day.`, [{ path: "dailyLimit", message: `Max ${mb.dailyLimit}` }]);
    }
    fromEmail = mb.email;
  }
  await sql`
    update campaigns set name = ${b.name}, mailbox_id = ${b.mailboxId}, from_email = ${fromEmail}, tone = ${b.tone},
      daily_email_limit = ${b.dailyLimit}, total_limit = ${b.totalLimit}, send_window = ${JSON.stringify(b.sendWindow)},
      allow_template_fallback = ${b.allowTemplateFallback}, updated_at = now()
    where id = ${id} and workspace_id = ${actor.workspaceId}`;
  return loadCampaign(actor.workspaceId, id);
}

export async function updateAudience(actor: Actor, id: number, input: unknown): Promise<CampaignRecord> {
  const c = await requireBuilderCampaign(actor.workspaceId, id);
  if (!isStructureEditable(c.status)) throw new AppError("CONFLICT", "The audience can only be changed before the campaign is approved.");
  const def = audienceDefinitionSchema.parse(input);
  if (def.source === "segment") {
    const seg = await sql`select name from segments where id = ${def.segmentId ?? 0} and workspace_id = ${actor.workspaceId}`;
    if (seg.length === 0) throw new AppError("NOT_FOUND", "That segment doesn't exist in this workspace.");
  }
  const label = def.source === "segment" ? "Saved segment" : def.source === "leads" ? `${def.leadIds.length} selected leads` : "All leads";
  await sql`update campaigns set audience_definition = ${JSON.stringify(def)}, audience_label = ${label}, updated_at = now() where id = ${id} and workspace_id = ${actor.workspaceId}`;
  return loadCampaign(actor.workspaceId, id);
}

/**
 * Replaces the sequence. Before approval: anything goes. After approval: same number of steps, waits unchanged,
 * steps that already went out are locked; changed copy of unsent steps is re-rendered into the pending sends.
 */
export async function updateSteps(actor: Actor, id: number, input: unknown): Promise<CampaignRecord> {
  const c = await requireBuilderCampaign(actor.workspaceId, id);
  const raw = Array.isArray(input) ? input : [];
  if (raw.length === 0) throw new AppError("VALIDATION_ERROR", "A campaign needs at least one step.");
  if (raw.length > MAX_STEPS) throw new AppError("VALIDATION_ERROR", `A campaign can have at most ${MAX_STEPS} steps.`);
  const steps = raw.map((s) => stepInputSchema.parse(s));

  if (isStructureEditable(c.status)) {
    await writeSteps(id, steps);
    await touch(actor.workspaceId, id);
    return loadCampaign(actor.workspaceId, id);
  }
  if (!isContentEditable(c.status)) throw new AppError("CONFLICT", `A ${c.status} campaign can't be edited.`);
  if (steps.length !== c.steps.length) throw new AppError("CONFLICT", "Steps can't be added or removed after approval.");

  const sent = c.status === "ready" ? new Set<number>() : await loadSentStepIds(actor.workspaceId, id);
  const changed: { stepId: number; order: number; subject: string; body: string }[] = [];
  steps.forEach((s, i) => {
    const old = c.steps[i];
    const subject = i === 0 ? s.subject : "";
    const same = old.body === s.body && old.subject === subject && old.waitDays === (i === 0 ? 0 : s.waitDays) && old.mode === (i === 0 ? s.mode : "template");
    if (same) return;
    if (old.waitDays !== (i === 0 ? 0 : s.waitDays) || old.mode !== (i === 0 ? s.mode : "template")) {
      throw new AppError("CONFLICT", `Step ${old.order}: timing and mode are fixed once a campaign is approved.`);
    }
    if (sent.has(old.id)) throw new AppError("CONFLICT", `Step ${old.order} has already been sent, so it can't be changed.`);
    changed.push({ stepId: old.id, order: old.order, subject, body: s.body });
  });
  if (changed.length === 0) return c;

  const updates = changed.map((ch) => sql`update campaign_steps set subject = ${ch.subject}, body = ${ch.body}, updated_at = now() where id = ${ch.stepId} and campaign_id = ${id}`);
  if (c.status === "ready") {
    // The approval covered the old copy: editing returns the campaign to draft and it must be approved again.
    assertTransition("ready", "draft");
    await sql.transaction([...updates, sql`update campaigns set status = 'draft', approval_id = null, approved_at = null, updated_at = now() where id = ${id} and workspace_id = ${actor.workspaceId} and status = 'ready'`]);
    await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.reopened", entityType: "campaign", entityId: id, summary: `Edited "${c.name}" after approval — it needs approval again` });
    return loadCampaign(actor.workspaceId, id);
  }

  // Running/paused: re-render the pending sends of each edited (unsent) step. Subjects of follow-ups are threaded from
  // step 1, which can only change here if step 1 itself hasn't gone out to anyone.
  await sql.transaction(updates);
  for (const ch of changed) await rerenderPendingSends(actor.workspaceId, id, ch);
  await touch(actor.workspaceId, id);
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.steps_edited", entityType: "campaign", entityId: id,
    summary: `Edited step ${changed.map((x) => x.order).join(", ")} of running campaign "${c.name}"`,
  });
  return loadCampaign(actor.workspaceId, id);
}

async function rerenderPendingSends(workspaceId: number, campaignId: number, ch: { stepId: number; order: number; subject: string; body: string }) {
  const rows = await sql`
    select cs.id, l.full_name, coalesce(co.name, l.company) as company, cs.message_draft_id
    from campaign_sends cs
    join leads l on l.id = cs.lead_id and l.workspace_id = cs.workspace_id
    left join companies co on co.id = l.company_id and co.workspace_id = l.workspace_id
    where cs.workspace_id = ${workspaceId} and cs.campaign_id = ${campaignId} and cs.step_id = ${ch.stepId} and cs.status = 'pending'`;
  // A lead's approved personalised draft is not overwritten by a template edit.
  const templated = rows.filter((r) => r.message_draft_id === null);
  if (templated.length === 0) return;
  const lead = (r: Record<string, unknown>) => ({ fullName: String(r.full_name), company: (r.company as string | null) ?? null });
  await sql.query(
    `update campaign_sends cs set body = x.body, subject = case when $3 then x.subject else cs.subject end
     from unnest($1::bigint[], $2::text[], $4::text[]) as x(id, body, subject)
     where cs.id = x.id and cs.workspace_id = $5 and cs.status = 'pending'`,
    [
      templated.map((r) => Number(r.id)),
      templated.map((r) => fillPlaceholders(ch.body, lead(r))),
      ch.order === 1,
      templated.map((r) => fillPlaceholders(ch.subject, lead(r))),
      workspaceId,
    ],
  );
  if (ch.order !== 1) return;
  // A new first subject changes every templated lead's thread: their pending follow-ups become "Re: <new subject>".
  const ids = templated.map((r) => Number(r.id));
  await sql.query(
    `update campaign_sends f set subject = x.subject
     from campaign_sends first, unnest($1::bigint[], $2::text[]) as x(first_id, subject)
     where first.id = x.first_id and f.campaign_lead_id = first.campaign_lead_id and f.id <> first.id
       and f.status = 'pending' and f.workspace_id = $3`,
    [ids, templated.map((r) => threadedSubject(fillPlaceholders(ch.subject, lead(r)))), workspaceId],
  );
}
