import { logActivity } from "@/lib/activity";
import { defaultToolRegistry, type AgentServices, type ToolRegistry } from "@/lib/agent/tools";
import { transitionStep, TERMINAL } from "@/lib/agent/orchestrator";
import { isApprovable, validatePlan } from "@/lib/agent/plan";
import { buildPlan } from "@/lib/agent/planner";
import { PROMPT_MAX_LENGTH, PROMPT_MIN_LENGTH, initialRunState, type Plan } from "@/lib/agent/types";
import { AppError, mapAiError } from "@/lib/api";
import { createLogger } from "@/lib/log";
import {
  createGennieRun, getGennieRun, icpConfigured, leadNames, leadOutcomeCounts, leadSnapshot, listGennieRuns,
  saveRunTokens, transitionGennieRun, type GennieRunRow,
} from "@/lib/db/gennie";
import { cancelResearch } from "@/lib/intelligence/service";
import { cancelJobs, enqueue } from "@/lib/jobs/queue";
import { kickWorker } from "@/lib/jobs/kick";
import { recordUsage } from "@/lib/domain/usage/record";
import type { LlmUsage } from "@/lib/ai/llm-types";
import { createAgentServices } from "./services";
import type { GennieHome, GennieRunView, RunResults, StepView } from "./view";

const log = createLogger({ scope: "gennie" });

export type Actor = { workspaceId: number; userId: number };
export type GennieDeps = { registry: ToolRegistry; services: AgentServices };

const defaultDeps = (): GennieDeps => ({ registry: defaultToolRegistry, services: createAgentServices() });

const CANCELABLE = ["planned", "awaiting_approval", "running", "paused"] as const;

async function loadRun(workspaceId: number, runId: number): Promise<GennieRunRow> {
  const run = Number.isInteger(runId) && runId > 0 ? await getGennieRun(workspaceId, runId) : null;
  if (!run) throw new AppError("NOT_FOUND", "That Gennie run doesn't exist.");
  return run;
}

// ---- plan ---------------------------------------------------------------------------------------------------

/**
 * Turns a request into a validated plan and stores it as `awaiting_approval`. NOTHING runs here: no research is
 * queued and no lead is touched until the user approves (approveRun).
 */
export async function planRun(actor: Actor, rawPrompt: string, deps: GennieDeps = defaultDeps()): Promise<{ runId: number; plan: Plan }> {
  const prompt = rawPrompt.trim();
  if (prompt.length < PROMPT_MIN_LENGTH) throw new AppError("VALIDATION_ERROR", "Tell Gennie what you want to do.");
  if (prompt.length > PROMPT_MAX_LENGTH) throw new AppError("VALIDATION_ERROR", `Keep the request under ${PROMPT_MAX_LENGTH} characters.`);

  const [snap, hasIcp] = await Promise.all([leadSnapshot(actor.workspaceId), icpConfigured(actor.workspaceId)]);
  const usage: LlmUsage[] = [];
  const meter = async (runId: number) => {
    if (usage.length === 0) return;
    await recordUsage(
      actor,
      usage.map((u) => ({ kind: "llm" as const, provider: "openai", model: u.model, tokensIn: u.tokensIn, tokensOut: u.tokensOut })),
      { type: "agent_run", id: runId, agentRunId: runId },
    );
    await saveRunTokens(actor.workspaceId, runId, usage.reduce((n, u) => n + u.tokensIn + u.tokensOut, 0));
  };

  let plan: Plan;
  try {
    plan = await buildPlan(
      prompt,
      {
        workspaceId: actor.workspaceId, registry: deps.registry, services: deps.services,
        snapshot: {
          totalLeads: snap.total, unresearchedLeads: snap.unresearched, researchedLeads: snap.researched,
          researchEngineAvailable: deps.services.engineAvailable(), icpConfigured: hasIcp,
        },
      },
      { onUsage: (u) => usage.push(u) },
    );
  } catch (err) {
    log.warn("gennie.plan_failed", { workspace_id: actor.workspaceId, err });
    const mapped = mapAiError(err);
    const message = mapped instanceof Error ? mapped.message : "Planning failed.";
    // Keep the failed attempt inspectable (and its token spend on the record) even though there is no plan.
    const runId = await createGennieRun({ ...actor, prompt, status: "failed", plan: null, error: message });
    await meter(runId);
    throw mapped;
  }

  const runId = await createGennieRun({ ...actor, prompt, status: isApprovable(plan) ? "awaiting_approval" : "planned", plan });
  await meter(runId);
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "gennie.planned", entityType: "agent_run", entityId: runId,
    summary: `Gennie planned: ${plan.goal}`,
  });
  return { runId, plan };
}

// ---- approve / control ---------------------------------------------------------------------------------------

/**
 * The only door to execution. Re-validates the STORED plan (the model's output is untrusted, and tools may have
 * become unavailable since), then flips awaiting_approval → running in one guarded UPDATE so a double click
 * can't start two runs.
 */
export async function approveRun(actor: Actor, runId: number, deps: GennieDeps = defaultDeps()): Promise<void> {
  const run = await loadRun(actor.workspaceId, runId);
  if (run.plan && run.plan.missingInputs.length > 0) throw new AppError("VALIDATION_ERROR", "Gennie needs more information before it can run this plan.");
  if (run.status !== "awaiting_approval" || !run.plan) {
    throw new AppError("CONFLICT", run.status === "planned" ? "This plan has nothing Gennie can run." : `This plan can't be approved (it is ${run.status.replace("_", " ")}).`);
  }

  const recheck = validatePlan(
    { goal: run.plan.goal, assumptions: [], unsupported: [], missingInputs: [], steps: run.plan.steps.map(({ id, tool, args, dependsOn, rationale }) => ({ id, tool, args, dependsOn, rationale })) },
    deps.registry, deps.services,
  );
  if (!recheck.ok) throw new AppError("VALIDATION_ERROR", `This plan is no longer valid: ${recheck.problems[0]}`);

  const state = initialRunState(run.plan, new Date());
  const moved = await transitionGennieRun(actor.workspaceId, runId, ["awaiting_approval"], "running", { progress: state });
  if (!moved) throw new AppError("CONFLICT", "This plan was already approved or canceled.");

  await enqueue({ workspaceId: actor.workspaceId, userId: actor.userId, type: "gennie_run", payload: { runId }, idempotencyKey: `gennie_run:${runId}:start`, agentRunId: runId });
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "gennie.approved", entityType: "agent_run", entityId: runId,
    summary: `Approved Gennie plan: ${run.plan.goal}`,
  });
  kickWorker();
}

export async function cancelRun(actor: Actor, runId: number): Promise<void> {
  const run = await loadRun(actor.workspaceId, runId);
  if (!(CANCELABLE as readonly string[]).includes(run.status)) throw new AppError("CONFLICT", `This run is already ${run.status.replace("_", " ")}.`);

  const state = run.state;
  if (state) for (const step of state.steps) if (!TERMINAL.includes(step.status)) transitionStep(step, "canceled", { summary: "Canceled.", finishedAt: new Date().toISOString() });
  const moved = await transitionGennieRun(actor.workspaceId, runId, [...CANCELABLE], "canceled", state ? { progress: state } : {});
  if (!moved) throw new AppError("CONFLICT", "This run just finished.");

  // Stop the fan-out: queued research jobs are canceled and running engine runs are asked to stop.
  const batchIds = (run.state?.steps ?? []).map((s) => s.state.batchRunId).filter((n): n is number => typeof n === "number");
  for (const batchRunId of batchIds) await cancelResearch(actor, batchRunId);
  await cancelJobs(actor.workspaceId, { agentRunId: runId });
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "gennie.canceled", entityType: "agent_run", entityId: runId, summary: "Canceled a Gennie run" });
}

export async function pauseRun(actor: Actor, runId: number): Promise<void> {
  await loadRun(actor.workspaceId, runId);
  if (!(await transitionGennieRun(actor.workspaceId, runId, ["running"], "paused"))) throw new AppError("CONFLICT", "Only a running run can be paused.");
}

export async function resumeRun(actor: Actor, runId: number): Promise<void> {
  await loadRun(actor.workspaceId, runId);
  if (!(await transitionGennieRun(actor.workspaceId, runId, ["paused"], "running"))) throw new AppError("CONFLICT", "Only a paused run can be resumed.");
  await cancelJobs(actor.workspaceId, { agentRunId: runId }); // exactly one live driver
  await enqueue({ workspaceId: actor.workspaceId, userId: actor.userId, type: "gennie_run", payload: { runId }, idempotencyKey: `gennie_run:${runId}:resume:${Date.now()}`, agentRunId: runId });
  kickWorker();
}

// ---- read models --------------------------------------------------------------------------------------------

function stepViews(run: GennieRunRow, labels: Record<string, string>): StepView[] {
  if (!run.plan) return [];
  return run.plan.steps.map((p) => {
    const s = run.state?.steps.find((x) => x.id === p.id);
    return {
      id: p.id, tool: p.tool, label: labels[p.tool] ?? p.tool, status: s?.status ?? "pending", costly: p.costly, rationale: p.rationale,
      summary: s?.summary ?? null, error: s?.error ?? null, estimatedRecords: p.estimatedRecords, estimateNote: p.estimateNote,
    };
  });
}

/** Counts come from the leads table; skipped/failed leads are listed with reasons. Nothing here is model-written. */
export async function getRunView(workspaceId: number, runId: number, deps: GennieDeps = defaultDeps()): Promise<GennieRunView> {
  const run = await loadRun(workspaceId, runId);
  const steps = stepViews(run, deps.registry.labels());

  const researching = run.state?.steps.find((s) => s.status === "running" && typeof s.state.batchRunId === "number");
  let live: GennieRunView["live"] = null;
  if (researching) {
    const p = await deps.services.researchProgress(workspaceId, researching.state.batchRunId as number);
    live = { done: p.succeeded + p.failed + p.canceled, total: p.total, failed: p.failed };
  }

  let results: RunResults | null = null;
  const leadIds = (run.state?.steps ?? []).find((s) => Array.isArray(s.output?.leadIds))?.output?.leadIds as number[] | undefined;
  if (leadIds) {
    const counts = await leadOutcomeCounts(workspaceId, leadIds);
    const rankStep = (run.state?.steps ?? []).find((s) => Array.isArray(s.output?.ranked));
    const raw = (run.state?.steps ?? []).flatMap((s) => [
      ...((Array.isArray(s.output?.skipped) ? s.output.skipped : []) as { leadId: number; reason: string }[]).map((x) => ({ leadId: x.leadId, reason: skipReason(x.reason) })),
      ...((Array.isArray(s.output?.errors) ? s.output.errors : []) as { leadId: number; message: string }[]).map((x) => ({ leadId: x.leadId, reason: x.message })),
    ]);
    const names = await leadNames(workspaceId, raw.map((r) => r.leadId));
    results = {
      ...counts,
      ranked: (rankStep?.output?.ranked as RunResults["ranked"]) ?? null,
      problems: raw.map((r) => ({ leadId: r.leadId, name: names.get(r.leadId) ?? `Lead #${r.leadId}`, reason: r.reason })),
    };
  }

  return {
    id: run.id, status: run.status, prompt: run.prompt, createdAt: run.createdAt, completedAt: run.completedAt, error: run.error,
    plan: run.plan, steps, live, results,
    canApprove: run.status === "awaiting_approval" && !!run.plan && isApprovable(run.plan),
    active: run.status === "running" || run.status === "paused",
  };
}

function skipReason(reason: string): string {
  if (reason === "already_running") return "Research for this lead was already queued.";
  if (reason === "no_company") return "No company, domain or email to research.";
  if (reason === "not_found") return "Lead no longer exists.";
  return reason;
}

// ---- Command Center home ------------------------------------------------------------------------------------

/** Example prompts come from the workspace's real state — never from a canned list that may not apply. */
export async function getHome(workspaceId: number, deps: GennieDeps = defaultDeps()): Promise<GennieHome> {
  const [snap, runs] = await Promise.all([leadSnapshot(workspaceId), listGennieRuns(workspaceId, 5)]);
  const engineAvailable = deps.services.engineAvailable();
  const suggestions: string[] = [];
  if (snap.unresearched > 0 && engineAvailable) suggestions.push(`Research my ${Math.min(snap.unresearched, 20)} newest unresearched leads`);
  if (snap.researched > 0) {
    suggestions.push("Which of my researched leads should I contact first?");
    suggestions.push("Show my top 5 leads by ICP score");
  }
  return { suggestions, recent: runs.map((r) => ({ id: r.id, status: r.status, prompt: r.prompt, createdAt: r.createdAt })), leadCount: snap.total, engineAvailable };
}

