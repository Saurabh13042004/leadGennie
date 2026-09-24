import { logActivity } from "@/lib/activity";
import { advance, type RunHooks } from "@/lib/agent/orchestrator";
import { defaultToolRegistry } from "@/lib/agent/tools";
import { RUN_TIMEOUT_MS, type RunState } from "@/lib/agent/types";
import {
  appendRunStep, getGennieRun, getGennieRunStatus, leadOutcomeCounts, saveRunProgress, transitionGennieRun,
} from "@/lib/db/gennie";
import { registerJobHandler } from "@/lib/jobs/registry";
import { PermanentJobError, type HandlerOutcome, type JobContext } from "@/lib/jobs/types";
import { createAgentServices } from "./services";

/**
 * `gennie_run`: drives an APPROVED plan one tick at a time. State lives in agent_runs.progress and each tool is
 * idempotent, so a worker crash / lease expiry / restart just re-enters here and carries on — it never repeats
 * finished steps and never re-queues research that is already queued.
 */

async function finalize(workspaceId: number, runId: number, userId: number | null, state: RunState): Promise<void> {
  const leadIds = (state.steps.find((s) => Array.isArray(s.output?.leadIds))?.output?.leadIds ?? []) as number[];
  const counts = await leadOutcomeCounts(workspaceId, leadIds);
  const output = {
    leads_considered: counts.considered, researched: counts.researched, qualified: counts.qualified,
    research_failed: counts.researchFailed, avg_icp_score: counts.avgIcpScore,
  };
  if (await transitionGennieRun(workspaceId, runId, ["running"], "completed", { output, progress: state })) {
    await logActivity({ workspaceId, actorUserId: userId, type: "gennie.completed", entityType: "agent_run", entityId: runId, summary: `Gennie run finished: ${counts.considered} lead(s) considered` });
  }
}

async function fail(workspaceId: number, runId: number, userId: number | null, error: string, state?: RunState): Promise<void> {
  if (await transitionGennieRun(workspaceId, runId, ["running"], "failed", { error, ...(state ? { progress: state } : {}) })) {
    await logActivity({ workspaceId, actorUserId: userId, type: "gennie.failed", entityType: "agent_run", entityId: runId, summary: `Gennie run failed: ${error}` });
  }
}

export async function gennieRunHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const runId = Number(ctx.job.payload.runId);
  const { workspaceId } = ctx;
  const run = await getGennieRun(workspaceId, runId);
  if (!run || !run.plan) throw new PermanentJobError("Gennie run not found or has no plan.");
  // Not approved / paused / canceled / finished: nothing to do. This is what makes "no approval, no run" hold
  // even if a job were ever enqueued by mistake. (Checked BEFORE requiring state: an unapproved run has none yet.)
  if (run.status !== "running") return { kind: "done", result: { skipped: run.status } };
  if (!run.state) throw new PermanentJobError("Gennie run has no state.");

  const userId = run.userId ?? ctx.userId;
  if (userId === null) throw new PermanentJobError("Gennie run has no user to act as.");

  if (run.state.approvedAt && Date.now() - new Date(run.state.approvedAt).getTime() > RUN_TIMEOUT_MS) {
    await fail(workspaceId, runId, userId, "This run took longer than 30 minutes and was stopped.", run.state);
    return { kind: "done", result: { timedOut: true } };
  }

  const hooks: RunHooks = {
    persist: (state) => saveRunProgress(workspaceId, runId, state),
    recordStep: (rec) => appendRunStep(workspaceId, runId, rec),
    shouldStop: async () => (await getGennieRunStatus(workspaceId, runId)) !== "running",
  };

  try {
    const result = await advance({
      plan: run.plan, state: run.state, registry: defaultToolRegistry, hooks,
      ctx: { workspaceId, userId, runId, services: createAgentServices(), log: ctx.log },
    });
    if (result.kind === "wait") return { kind: "wait", afterSeconds: result.afterSeconds, state: {} };
    if (result.kind === "completed") await finalize(workspaceId, runId, userId, result.state);
    else if (result.kind === "failed") await fail(workspaceId, runId, userId, result.error, result.state);
    return { kind: "done", result: { outcome: result.kind } };
  } catch (err) {
    // An unexpected error retries with backoff; on the last attempt the run is closed instead of left "running" forever.
    if (ctx.job.attempts + 1 >= ctx.job.maxAttempts) {
      await fail(workspaceId, runId, userId, "Gennie hit an unexpected error and stopped. Nothing was sent.", run.state);
    }
    throw err;
  }
}

registerJobHandler("gennie_run", gennieRunHandler);
