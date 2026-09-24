import { createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { dateOnly } from "@/lib/db/dates";
import { AppError } from "@/lib/api/errors";
import { onJobSettled, registerJobHandler } from "@/lib/jobs/registry";
import { JobError, PermanentJobError, type HandlerOutcome, type JobContext } from "@/lib/jobs/types";
import { jobCounts } from "@/lib/jobs/queue";
import { appendEngineSteps, createAgentRun, finishAgentRun, updateAgentRunProgress } from "@/lib/domain/agent-runs/service";
import { recordUsage } from "@/lib/domain/usage/record";
import { getIntelligenceClient, IntelligenceError } from "./client";
import { persistResearch, QuarantineError } from "./persist";
import { buildResearchRequest, loadCompanySubject, loadLeadSubject, loadWorkspaceContext, type ResearchSubject } from "./request";
import { toEngineIcp } from "./icp";
import { researchResultSchema, type EngineRunView } from "./schemas";

/**
 * Job handlers that drive an engine run to completion without ever holding a request open:
 *
 *   tick 1: submit the run (idempotent key)  →  wait 2s
 *   tick n: poll it                          →  wait again / finish
 *
 * State lives on the job row, so it survives a restart of THIS worker; a restart of the ENGINE (it forgets the
 * run) is handled by resubmitting under the same idempotency key. Failures are classified: retryable (network,
 * rate limit, engine restarting) back off; permanent (quota, bad credentials, contract violation, invalid result)
 * dead-letter immediately with a message a person can act on.
 */

/** Unique per (workspace, entity, version) but OPAQUE: the engine never sees a workspace or record identifier. */
export function engineKey(kind: "lead" | "company", workspaceId: number, id: number, version: number): string {
  return `research:${createHash("sha256").update(`${workspaceId}:${kind}:${id}:${version}`).digest("hex").slice(0, 24)}`;
}

type EngineJobState = { engineRunId?: string; key?: string; startedAt?: number; polls?: number; resubmits?: number; childRunId?: number };

const MAX_WAIT_MS = 10 * 60_000;
const MAX_RESUBMITS = 3;

const wait = (state: EngineJobState, afterSeconds: number): HandlerOutcome => ({ kind: "wait", afterSeconds, state: state as Record<string, unknown> });

/** Engine/contract errors → job errors with the right retry behaviour. */
function toJobError(err: unknown): unknown {
  if (err instanceof IntelligenceError) {
    return err.retryable ? new JobError(err.message, { retryable: true }) : new PermanentJobError(err.message);
  }
  if (err instanceof AppError) return new PermanentJobError(err.message); // e.g. NOT_CONFIGURED, NOT_FOUND
  return err;
}

type Advance = { done: false; outcome: HandlerOutcome } | { done: true; view: EngineRunView; engineRunId: string; state: EngineJobState };

/** One step of the submit/poll state machine, shared by lead and company research. */
async function advance(ctx: JobContext, buildKey: () => string, makeRequest: (key: string) => Promise<Parameters<ReturnType<typeof getIntelligenceClient>["createRun"]>[0]>): Promise<Advance> {
  const client = getIntelligenceClient();
  const state = { ...(ctx.job.state as EngineJobState) };
  const meta = { agentRunId: state.childRunId ?? ctx.job.agentRunId, jobId: ctx.job.id, workspaceId: ctx.workspaceId };
  state.startedAt ??= Date.now();
  if (Date.now() - state.startedAt > MAX_WAIT_MS) {
    throw new PermanentJobError("The research engine did not finish in time. Try again.");
  }

  const submit = async () => {
    state.key ??= buildKey();
    const created = await client.createRun(await makeRequest(state.key), meta);
    state.engineRunId = created.runId;
    state.polls = 0;
  };

  if (!state.engineRunId) {
    await submit();
    return { done: false, outcome: wait(state, 2) };
  }

  let view: EngineRunView;
  try {
    view = await client.getRun(state.engineRunId, meta);
  } catch (err) {
    if (err instanceof IntelligenceError && err.engineCode === "NOT_FOUND") {
      // The engine restarted and forgot the run: resubmit under the SAME key (idempotent) rather than fail.
      state.resubmits = (state.resubmits ?? 0) + 1;
      if (state.resubmits > MAX_RESUBMITS) throw new PermanentJobError("The research engine keeps losing this run. Try again later.");
      ctx.log.warn("engine.run_lost_resubmitting", { engine_run_id: state.engineRunId });
      await submit();
      return { done: false, outcome: wait(state, 2) };
    }
    throw err;
  }

  state.polls = (state.polls ?? 0) + 1;
  if (view.status === "queued" || view.status === "running") {
    return { done: false, outcome: wait(state, Math.min(2 + state.polls, 10)) };
  }
  if (view.status === "canceled") return { done: false, outcome: { kind: "done", result: { canceled: true } } };
  if (view.status === "failed") {
    const e = view.error;
    const message = e?.message ?? "The research engine failed.";
    throw e && e.retryable && e.code !== "QUOTA_EXCEEDED" ? new JobError(message, { retryable: true }) : new PermanentJobError(message);
  }
  return { done: true, view, engineRunId: state.engineRunId, state };
}

async function ensureChildRun(ctx: JobContext, type: string, input: Record<string, unknown>): Promise<number> {
  const state = ctx.job.state as EngineJobState;
  if (state.childRunId) return state.childRunId;
  return createAgentRun({ workspaceId: ctx.workspaceId, userId: ctx.userId, type, input, parentRunId: ctx.job.agentRunId, status: "running" });
}

async function importRunTelemetry(ctx: JobContext, childRunId: number, view: EngineRunView, ref: { type: string; id: number }) {
  await appendEngineSteps(ctx.workspaceId, childRunId, view.trace);
  await recordUsage(
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    view.usage.map((u) => ({ kind: u.kind, provider: u.provider, model: u.model ?? null, units: u.units, tokensIn: u.tokens_in, tokensOut: u.tokens_out, costEstimate: u.cost_estimate })),
    { type: ref.type, id: ref.id, agentRunId: childRunId },
  );
}

/** When every job of a batch has settled, close the parent run so the UI stops polling. */
export async function settleBatchRun(workspaceId: number, batchRunId: number | null): Promise<void> {
  if (!batchRunId) return;
  // Only BATCH runs (research_batch, personalization_batch) are closed by counting their jobs. A run of any other
  // kind (e.g. a Gennie run, which owns its lifecycle) may have jobs that carry its id — settling those must never
  // overwrite its progress or mark it completed.
  const kind = await sql`select type from agent_runs where id = ${batchRunId} and workspace_id = ${workspaceId}`;
  if (kind.length === 0 || !String(kind[0].type).endsWith("_batch")) return;
  const c = await jobCounts(workspaceId, batchRunId);
  const total = c.queued + c.running + c.succeeded + c.failed + c.dead + c.canceled;
  await updateAgentRunProgress(workspaceId, batchRunId, { total, ...c });
  if (c.queued + c.running > 0) return;
  const status = c.dead + c.failed === total ? "failed" : c.canceled === total ? "canceled" : "completed";
  await finishAgentRun(workspaceId, batchRunId, { status, output: { total, succeeded: c.succeeded, failed: c.dead + c.failed, canceled: c.canceled } });
}

// ---- lead research ---------------------------------------------------------------------------------------------

async function markLeadResearch(workspaceId: number, leadId: number, status: "running" | "failed") {
  await sql`
    update leads set research_status = ${status}, updated_at = now()
    where id = ${leadId} and workspace_id = ${workspaceId} and research_status in ('queued', 'running', 'failed', 'none', 'done', 'partial')
  `;
}

const isFinal = (ctx: JobContext, err: unknown) =>
  err instanceof PermanentJobError || (err instanceof JobError && !err.opts.retryable) || ctx.job.attempts + 1 >= ctx.job.maxAttempts;

export async function leadResearchHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const leadId = Number(ctx.job.payload.leadId);
  const version = Number(ctx.job.payload.version ?? 1);
  if (!Number.isInteger(leadId)) throw new PermanentJobError("Invalid job payload.");
  try {
    const subject = await loadLeadSubject(ctx.workspaceId, leadId);
    const childRunId = await ensureChildRun(ctx, "research_lead", { leadId, version });
    (ctx.job.state as EngineJobState).childRunId = childRunId;

    const step = await advance(
      ctx,
      () => engineKey("lead", ctx.workspaceId, leadId, version),
      (key) => buildResearchRequest(ctx.workspaceId, subject, { idempotencyKey: key }),
    );
    if (!step.done) {
      await markLeadResearch(ctx.workspaceId, leadId, "running");
      if (step.outcome.kind === "wait") step.outcome.state = { ...step.outcome.state, childRunId };
      return step.outcome;
    }

    let parsed;
    try {
      parsed = researchResultSchema.parse(step.view.result);
    } catch (err) {
      throw new QuarantineError([`response does not match the contract: ${err instanceof Error ? err.message.slice(0, 200) : "invalid"}`]);
    }
    const outcome = await persistResearch({
      workspaceId: ctx.workspaceId, userId: ctx.userId, leadId, companyId: subject.companyId, agentRunId: childRunId,
      engineRunId: step.engineRunId, contractVersion: "1.0", result: parsed,
    });
    await importRunTelemetry(ctx, childRunId, step.view, { type: "lead", id: leadId });
    await finishAgentRun(ctx.workspaceId, childRunId, { status: "completed", output: { ...outcome }, tokensUsed: step.view.usage.reduce((n, u) => n + u.tokens_in + u.tokens_out, 0) });
    return { kind: "done", result: { ...outcome } };
  } catch (err) {
    const translated = err instanceof QuarantineError ? new PermanentJobError(err.message) : toJobError(err);
    if (isFinal(ctx, translated)) {
      await markLeadResearch(ctx.workspaceId, leadId, "failed").catch(() => undefined);
      const child = (ctx.job.state as EngineJobState).childRunId;
      if (child) await finishAgentRun(ctx.workspaceId, child, { status: "failed", error: translated instanceof Error ? translated.message : "failed" }).catch(() => undefined);
    }
    throw translated;
  }
}

// ---- company research ----------------------------------------------------------------------------------------------

export async function companyResearchHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const companyId = Number(ctx.job.payload.companyId);
  const version = Number(ctx.job.payload.version ?? 1);
  if (!Number.isInteger(companyId)) throw new PermanentJobError("Invalid job payload.");
  try {
    const subject: ResearchSubject = await loadCompanySubject(ctx.workspaceId, companyId);
    const childRunId = await ensureChildRun(ctx, "research_company", { companyId, version });
    const step = await advance(
      ctx,
      () => engineKey("company", ctx.workspaceId, companyId, version),
      (key) => buildResearchRequest(ctx.workspaceId, subject, { idempotencyKey: key, task: "company_research" }),
    );
    if (!step.done) {
      if (step.outcome.kind === "wait") step.outcome.state = { ...step.outcome.state, childRunId };
      return step.outcome;
    }
    let parsed;
    try {
      parsed = researchResultSchema.parse(step.view.result);
    } catch (err) {
      throw new QuarantineError([`response does not match the contract: ${err instanceof Error ? err.message.slice(0, 200) : "invalid"}`]);
    }
    const outcome = await persistResearch({
      workspaceId: ctx.workspaceId, userId: ctx.userId, leadId: null, companyId, agentRunId: childRunId,
      engineRunId: step.engineRunId, contractVersion: "1.0", result: parsed,
    });
    await importRunTelemetry(ctx, childRunId, step.view, { type: "company", id: companyId });
    await finishAgentRun(ctx.workspaceId, childRunId, { status: "completed", output: { ...outcome } });
    return { kind: "done", result: { ...outcome } };
  } catch (err) {
    throw err instanceof QuarantineError ? new PermanentJobError(err.message) : toJobError(err);
  }
}

// ---- re-scoring after an ICP edit (no research, no LLM: a pure function of stored verified inputs) ----------------

export async function leadScoringHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const leadId = Number(ctx.job.payload.leadId);
  if (!Number.isInteger(leadId)) throw new PermanentJobError("Invalid job payload.");
  try {
    const rows = await sql`
      select r.id as research_id, r.scoring_inputs, r.icp_breakdown, l.job_title, c.domain as company_domain
      from lead_research r
      join leads l on l.id = r.lead_id and l.workspace_id = r.workspace_id
      left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
      where r.lead_id = ${leadId} and r.workspace_id = ${ctx.workspaceId} and r.is_current
    `;
    if (rows.length === 0) return { kind: "done", result: { skipped: "not_researched" } };
    const r = rows[0];
    const inputs = (r.scoring_inputs ?? {}) as { industry?: string | null; country?: string | null; employee_count?: number | null; keywords_found?: string[]; person_title?: string | null };
    const signals = await sql`
      select id, type, confidence, detected_at from signals
      where lead_id = ${leadId} and workspace_id = ${ctx.workspaceId} and is_current and verified
    `;
    const { icp } = await loadWorkspaceContext(ctx.workspaceId);
    const score = await getIntelligenceClient().score(
      {
        icp: toEngineIcp(icp),
        company: { industry: inputs.industry ?? null, country: inputs.country ?? null, employee_count: inputs.employee_count ?? null, domain: (r.company_domain as string | null) ?? null, keywords_found: inputs.keywords_found ?? [] },
        person: { title: (r.job_title as string | null) ?? inputs.person_title ?? null },
        signals: signals.map((s) => ({ id: String(s.id), type: s.type as never, confidence: Number(s.confidence), detected_at: dateOnly(s.detected_at), verified: true })),
      },
      { jobId: ctx.job.id, workspaceId: ctx.workspaceId },
    );
    // Keep the evidence links the last full run established for each criterion that still exists.
    const previous = new Map(((r.icp_breakdown ?? []) as { criterion: string; evidence_ids: number[] }[]).map((b) => [b.criterion, b.evidence_ids]));
    const breakdown = score.icp.breakdown.map((b) => ({ ...b, evidence_ids: previous.get(b.criterion) ?? [] }));
    await sql.transaction([
      sql`update lead_research set icp_score = ${score.icp.score}, icp_confidence = ${score.icp.confidence}, icp_breakdown = ${JSON.stringify(breakdown)},
            intent_breakdown = ${JSON.stringify(score.intent.breakdown)}, why_fit = ${JSON.stringify(score.why_fit)}, scoring_version = ${score.scoring_version},
            qualified = ${score.qualified}
          where id = ${Number(r.research_id)} and workspace_id = ${ctx.workspaceId}`,
      sql`update leads set icp_score = ${score.icp.score}, intent_score = ${score.intent.score}, scoring_version = ${score.scoring_version},
            qualified = ${score.qualified}, updated_at = now()
          where id = ${leadId} and workspace_id = ${ctx.workspaceId}`,
    ]);
    return { kind: "done", result: { icp_score: score.icp.score, intent_score: score.intent.score } };
  } catch (err) {
    throw toJobError(err);
  }
}

registerJobHandler("lead_research", leadResearchHandler);
onJobSettled(async (job) => settleBatchRun(job.workspaceId, job.agentRunId));
registerJobHandler("company_research", companyResearchHandler);
registerJobHandler("lead_scoring", leadScoringHandler);
