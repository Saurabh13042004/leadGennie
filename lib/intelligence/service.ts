import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { cancelJobs, enqueue, jobCounts } from "@/lib/jobs/queue";
import { kickWorker } from "@/lib/jobs/kick";
import { createAgentRun } from "@/lib/domain/agent-runs/service";
import { getIntelligenceClient, isIntelligenceConfigured } from "./client";
import { icpFingerprint } from "./icp";
import { loadWorkspaceContext } from "./request";

/** Bulk research is capped per request: it bounds LLM/search spend and keeps the queue fair (spec: default 50). */
export const MAX_BULK_RESEARCH = 50;

/** `parentRunId` links the batch to the run that started it (e.g. a Gennie run), atomically with its creation. */
export type ActorCtx = { workspaceId: number; userId: number; parentRunId?: number | null };

export type EnqueueResult = {
  agentRunId: number;
  enqueued: { leadId: number; jobId: number }[];
  skipped: { leadId: number; reason: "not_found" | "no_company" | "already_running" }[];
};

/**
 * Queues research for leads. Idempotent per (lead, research version): a double click, a retried request or a
 * page reload never starts a second run — re-researching a lead that already has research is a new version and
 * therefore a deliberate new run.
 */
export async function enqueueLeadResearch(actor: ActorCtx, leadIds: number[]): Promise<EnqueueResult> {
  const ids = Array.from(new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0)));
  if (ids.length === 0) throw new AppError("VALIDATION_ERROR", "Select at least one lead.");
  if (ids.length > MAX_BULK_RESEARCH) {
    throw new AppError("VALIDATION_ERROR", `You can research up to ${MAX_BULK_RESEARCH} leads at a time. Select fewer and run again.`);
  }
  // Fail fast with a clear message (not a job that dies later) if the engine isn't set up at all.
  if (!isIntelligenceConfigured()) {
    throw new AppError("NOT_CONFIGURED", "The research engine is not configured yet. Ask an admin to set INTELLIGENCE_URL and its credentials.");
  }

  const rows = await sql`
    select l.id, l.email, l.company, l.company_id, l.research_status,
           c.name as company_name, c.domain as company_domain,
           (select count(*)::int from lead_research r where r.lead_id = l.id and r.workspace_id = l.workspace_id) as versions
    from leads l
    left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
    where l.workspace_id = ${actor.workspaceId} and l.id = any(${ids}::bigint[])
  `;
  const byId = new Map(rows.map((r) => [Number(r.id), r]));

  const skipped: EnqueueResult["skipped"] = [];
  const todo: { leadId: number; version: number }[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) skipped.push({ leadId: id, reason: "not_found" });
    else if (!r.company_name && !r.company && !r.company_domain && !r.email) skipped.push({ leadId: id, reason: "no_company" });
    else todo.push({ leadId: id, version: Number(r.versions) + 1 });
  }

  const agentRunId = await createAgentRun({
    workspaceId: actor.workspaceId, userId: actor.userId, type: "research_batch", input: { leadIds: ids }, parentRunId: actor.parentRunId ?? null,
    status: todo.length === 0 ? "completed" : "running",
  });

  const enqueued: EnqueueResult["enqueued"] = [];
  for (const { leadId, version } of todo) {
    const { job, created } = await enqueue({
      workspaceId: actor.workspaceId, userId: actor.userId, type: "lead_research",
      payload: { leadId, version }, idempotencyKey: `lead_research:${leadId}:v${version}`, agentRunId,
    });
    if (!created) skipped.push({ leadId, reason: "already_running" }); // same version already queued/ran
    else enqueued.push({ leadId, jobId: job.id });
  }
  if (enqueued.length > 0) {
    await sql`
      update leads set research_status = 'queued', updated_at = now()
      where workspace_id = ${actor.workspaceId} and id = any(${enqueued.map((e) => e.leadId)}::bigint[])
    `;
    await logActivity({
      workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "research.requested", entityType: "agent_run", entityId: agentRunId,
      summary: `Requested research for ${enqueued.length} lead(s)`,
    });
    kickWorker();
  }
  return { agentRunId, enqueued, skipped };
}

export type ResearchProgress = {
  agentRunId: number;
  status: string;
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  canceled: number;
  finished: boolean;
  errors: { leadId: number; message: string }[];
};

/** Progress is derived from the jobs themselves (the source of truth), never from a counter that can drift. */
export async function getResearchProgress(workspaceId: number, agentRunId: number): Promise<ResearchProgress> {
  const run = await sql`select id, status from agent_runs where id = ${agentRunId} and workspace_id = ${workspaceId}`;
  if (run.length === 0) throw new AppError("NOT_FOUND", "Research run not found.");
  const c = await jobCounts(workspaceId, agentRunId);
  const failedJobs = await sql`
    select payload->>'leadId' as lead_id, error from jobs
    where workspace_id = ${workspaceId} and agent_run_id = ${agentRunId} and status in ('dead', 'failed') order by id limit 20
  `;
  const total = c.queued + c.running + c.succeeded + c.failed + c.dead + c.canceled;
  return {
    agentRunId, status: String(run[0].status), total, queued: c.queued, running: c.running, succeeded: c.succeeded,
    failed: c.failed + c.dead, canceled: c.canceled, finished: c.queued + c.running === 0,
    errors: failedJobs.map((j) => ({ leadId: Number(j.lead_id), message: String(j.error ?? "Failed") })),
  };
}

/** Stops queued jobs, asks the engine to stop running ones, and puts the leads back to a truthful status. */
export async function cancelResearch(actor: ActorCtx, agentRunId: number): Promise<{ canceled: number }> {
  const jobs = await sql`
    select id, payload->>'leadId' as lead_id, state->>'engineRunId' as engine_run_id from jobs
    where workspace_id = ${actor.workspaceId} and agent_run_id = ${agentRunId} and status in ('queued', 'running')
  `;
  const canceled = await cancelJobs(actor.workspaceId, { agentRunId });
  const engineRuns = jobs.map((j) => j.engine_run_id as string | null).filter((x): x is string => !!x);
  if (engineRuns.length > 0 && isIntelligenceConfigured()) {
    const client = getIntelligenceClient();
    await Promise.allSettled(engineRuns.map((id) => client.cancelRun(id)));
  }
  const leadIds = jobs.map((j) => Number(j.lead_id)).filter((n) => Number.isInteger(n));
  if (leadIds.length > 0) {
    await sql`
      update leads set research_status = case when researched_at is null then 'none' else 'done' end, updated_at = now()
      where workspace_id = ${actor.workspaceId} and id = any(${leadIds}::bigint[]) and research_status in ('queued', 'running')
    `;
  }
  await sql`update agent_runs set status = 'canceled', completed_at = now() where id = ${agentRunId} and workspace_id = ${actor.workspaceId} and status = 'running'`;
  return { canceled };
}

/** After an ICP edit: re-score every researched lead as a cheap background job (no research, no LLM). */
export async function enqueueRescoreAll(actor: ActorCtx): Promise<{ enqueued: number }> {
  const { icp } = await loadWorkspaceContext(actor.workspaceId);
  const fp = await icpFingerprint(icp);
  const leads = await sql`
    select distinct lead_id from lead_research where workspace_id = ${actor.workspaceId} and is_current
  `;
  let enqueued = 0;
  for (const l of leads) {
    const { created } = await enqueue({
      workspaceId: actor.workspaceId, userId: actor.userId, type: "lead_scoring",
      payload: { leadId: Number(l.lead_id) }, idempotencyKey: `lead_scoring:${l.lead_id}:${fp}`,
    });
    if (created) enqueued++;
  }
  if (enqueued > 0) kickWorker();
  return { enqueued };
}

export async function enqueueRescoreLead(actor: ActorCtx, leadId: number): Promise<{ enqueued: boolean }> {
  const owned = await sql`select id from leads where id = ${leadId} and workspace_id = ${actor.workspaceId}`;
  if (owned.length === 0) throw new AppError("NOT_FOUND", "Lead not found.");
  const { icp } = await loadWorkspaceContext(actor.workspaceId);
  const { created } = await enqueue({
    workspaceId: actor.workspaceId, userId: actor.userId, type: "lead_scoring",
    payload: { leadId }, idempotencyKey: `lead_scoring:${leadId}:${await icpFingerprint(icp)}`,
  });
  if (created) kickWorker();
  return { enqueued: created };
}
