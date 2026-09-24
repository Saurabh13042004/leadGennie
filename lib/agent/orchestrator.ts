import { AppError } from "@/lib/api/errors";
import type { ToolCtx, ToolRegistry } from "./tools";
import type { Plan, RunState, StepState, StepStatus } from "./types";

/**
 * Deterministic execution of an APPROVED plan — not a free-running agent loop. The model is used once, to plan;
 * everything here is a state machine over the plan: same input state → same next action. It can only call tools
 * named in the plan, with the plan's arguments (re-validated), in order.
 */

const ALLOWED: Record<StepStatus, StepStatus[]> = {
  pending: ["running", "skipped", "canceled"],
  running: ["succeeded", "failed", "canceled"],
  succeeded: [],
  failed: [],
  skipped: [],
  canceled: [],
};

export const TERMINAL: StepStatus[] = ["succeeded", "failed", "skipped", "canceled"];

/** Every step transition goes through here; an illegal one is a bug and throws. */
export function transitionStep(step: StepState, to: StepStatus, patch: Partial<StepState> = {}): void {
  if (!ALLOWED[step.status].includes(to)) throw new Error(`Illegal step transition ${step.status} → ${to} (${step.id})`);
  Object.assign(step, patch, { status: to });
}

export type StepRecord = {
  seq: number;
  tool: string;
  status: "ok" | "error" | "skipped" | "canceled";
  inputSummary: string;
  outputSummary: string;
  durationMs: number;
};

/** Persistence and cancellation, injected (dependency inversion) — the orchestrator never touches a database. */
export interface RunHooks {
  persist(state: RunState): Promise<void>;
  recordStep(record: StepRecord): Promise<void>;
  /** True when the run was canceled or paused: stop before starting more work. */
  shouldStop(): Promise<boolean>;
}

export type AdvanceResult =
  | { kind: "completed"; state: RunState }
  | { kind: "failed"; state: RunState; error: string }
  | { kind: "wait"; state: RunState; afterSeconds: number }
  | { kind: "stopped"; state: RunState };

const describeArgs = (args: Record<string, unknown>) => JSON.stringify(args).slice(0, 300);

export async function advance(input: {
  plan: Plan;
  state: RunState;
  ctx: ToolCtx;
  registry: ToolRegistry;
  hooks: RunHooks;
  now?: () => Date;
}): Promise<AdvanceResult> {
  const { plan, state, ctx, registry, hooks } = input;
  const now = input.now ?? (() => new Date());
  const planStep = new Map(plan.steps.map((s) => [s.id, s]));
  const failStep = async (step: StepState, error: string, output: Record<string, unknown> | null = null) => {
    transitionStep(step, "failed", { error, output, finishedAt: now().toISOString() });
    await recordFinished(step);
  };
  const recordFinished = async (step: StepState) => {
    const started = step.startedAt ? new Date(step.startedAt).getTime() : now().getTime();
    const seq = state.steps.findIndex((s) => s.id === step.id) + 1;
    await hooks.recordStep({
      seq, tool: step.tool,
      status: step.status === "succeeded" ? "ok" : step.status === "failed" ? "error" : step.status === "canceled" ? "canceled" : "skipped",
      inputSummary: describeArgs(planStep.get(step.id)?.args ?? {}),
      outputSummary: step.error ?? step.summary ?? "",
      durationMs: Math.max(0, now().getTime() - started),
    });
  };

  for (const step of state.steps) {
    if (TERMINAL.includes(step.status)) continue;
    if (await hooks.shouldStop()) return { kind: "stopped", state };

    const spec = planStep.get(step.id);
    const tool = spec ? registry.get(spec.tool) : undefined;

    // A dependency that did not succeed means this step has nothing to work on.
    const blocked = spec?.dependsOn.find((d) => state.steps.find((s) => s.id === d)?.status !== "succeeded");
    if (blocked) {
      transitionStep(step, "skipped", { summary: `Skipped: ${blocked} did not complete.`, finishedAt: now().toISOString() });
      await recordFinished(step);
      await hooks.persist(state);
      continue;
    }

    // Fail closed: the stored plan is untrusted data at execution time too.
    if (!spec || !tool || !tool.available(ctx.services)) {
      if (step.status === "pending") transitionStep(step, "running", { startedAt: now().toISOString() });
      await failStep(step, "This step's tool is not available.");
      await hooks.persist(state);
      return { kind: "failed", state: skipRest(state, step, now), error: step.error ?? "Step failed." };
    }
    const parsed = tool.inputSchema.safeParse(spec.args);
    if (!parsed.success) {
      if (step.status === "pending") transitionStep(step, "running", { startedAt: now().toISOString() });
      await failStep(step, "This step's arguments are not valid.");
      await hooks.persist(state);
      return { kind: "failed", state: skipRest(state, step, now), error: step.error ?? "Step failed." };
    }

    if (step.status === "pending") {
      transitionStep(step, "running", { startedAt: now().toISOString() });
      await hooks.persist(state);
    }

    const deps: Record<string, Record<string, unknown>> = {};
    for (const d of spec.dependsOn) deps[d] = state.steps.find((s) => s.id === d)?.output ?? {};

    let outcome;
    try {
      outcome = await tool.run(ctx, parsed.data, { state: step.state, deps });
    } catch (err) {
      if (err instanceof AppError) {
        await failStep(step, err.message);
        await hooks.persist(state);
        return { kind: "failed", state: skipRest(state, step, now), error: err.message };
      }
      throw err; // a bug or an outage: let the job retry with backoff (the step stays "running", state intact)
    }

    if (outcome.kind === "wait") {
      step.state = outcome.state;
      if (outcome.summary) step.summary = outcome.summary;
      await hooks.persist(state);
      return { kind: "wait", state, afterSeconds: outcome.afterSeconds };
    }
    if (outcome.kind === "failed") {
      await failStep(step, outcome.error, outcome.output ?? null);
      await hooks.persist(state);
      return { kind: "failed", state: skipRest(state, step, now), error: outcome.error };
    }
    transitionStep(step, "succeeded", { output: outcome.output, summary: outcome.summary, finishedAt: now().toISOString() });
    await recordFinished(step);
    await hooks.persist(state);
  }
  return { kind: "completed", state };
}

/** After a failure nothing later may run: mark every unfinished step skipped (recorded, not silently dropped). */
function skipRest(state: RunState, failed: StepState, now: () => Date): RunState {
  for (const s of state.steps) {
    if (s.id !== failed.id && (s.status === "pending" || s.status === "running")) {
      transitionStep(s, s.status === "pending" ? "skipped" : "canceled", { summary: `Skipped: ${failed.id} failed.`, finishedAt: now().toISOString() });
    }
  }
  return state;
}
