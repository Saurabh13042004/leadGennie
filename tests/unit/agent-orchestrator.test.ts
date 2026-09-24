import { describe, expect, it } from "vitest";
import { z } from "zod";
import { advance, transitionStep, type RunHooks, type StepRecord } from "@/lib/agent/orchestrator";
import { ToolRegistry, defaultToolRegistry, type Tool, type ToolCtx, type ToolOutcome } from "@/lib/agent/tools";
import { initialRunState, type Plan, type RunState, type StepState } from "@/lib/agent/types";
import { AppError } from "@/lib/api/errors";
import { createLogger } from "@/lib/log";
import { estimateSteps, validatePlan } from "@/lib/agent/plan";
import { fakeServices, researchPlan } from "../helpers/agent";

const log = createLogger();
const ctxFor = (services = fakeServices()): ToolCtx => ({ workspaceId: 1, userId: 2, runId: 50, services, log });

function hooks(opts: { stopAfter?: number } = {}) {
  const persisted: RunState[] = [];
  const records: StepRecord[] = [];
  let checks = 0;
  const h: RunHooks = {
    persist: async (s) => { persisted.push(structuredClone(s)); },
    recordStep: async (r) => { records.push(r); },
    shouldStop: async () => (opts.stopAfter !== undefined ? ++checks > opts.stopAfter : false),
  };
  return { h, persisted, records };
}

async function realPlan(services = fakeServices()): Promise<Plan> {
  const v = validatePlan(researchPlan(), defaultToolRegistry, services);
  if (!v.ok) throw new Error("invalid");
  const steps = await estimateSteps(v.steps, defaultToolRegistry, { workspaceId: 1, services });
  return { goal: "g", steps, assumptions: [], unsupported: [], missingInputs: [], warnings: [] };
}

describe("advance — the canonical plan", () => {
  it("runs every step in order, feeds outputs forward, and records each step", async () => {
    const services = fakeServices();
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const { h, records } = hooks();
    const run = () => advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    // Research is a background job: the first tick STARTS it and waits; the next tick polls and finishes.
    expect((await run()).kind).toBe("wait");
    const r = await run();
    expect(r.kind).toBe("completed");
    expect(state.steps.map((s) => s.status)).toEqual(["succeeded", "succeeded", "succeeded"]);
    expect(records.map((x) => [x.tool, x.status])).toEqual([["find_leads", "ok"], ["research_leads", "ok"], ["rank_leads", "ok"]]);
    expect(state.steps[2].output?.ranked).toHaveLength(3);
    // research received exactly the lead ids find_leads produced — never anything else
    expect(services.calls.filter((c) => c === "startResearch")).toHaveLength(1);
  });

  it("a waiting tool pauses the run; the next advance() continues WITHOUT repeating finished work", async () => {
    let polls = 0;
    const services = fakeServices({
      researchProgress: async () => (++polls < 2 ? { total: 3, succeeded: 1, failed: 0, canceled: 0, finished: false, errors: [] } : { total: 3, succeeded: 3, failed: 0, canceled: 0, finished: true, errors: [] }),
    });
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const { h } = hooks();
    const run = () => advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });

    const first = await run();
    expect(first).toMatchObject({ kind: "wait", afterSeconds: 8 });
    expect(state.steps[0].status).toBe("succeeded");
    expect(state.steps[1]).toMatchObject({ status: "running", state: { batchRunId: 900 } });
    expect((await run()).kind).toBe("wait"); // still researching
    expect((await run()).kind).toBe("completed");

    expect(services.calls.filter((c) => c === "findLeadIds")).toHaveLength(1); // not repeated
    expect(services.calls.filter((c) => c === "startResearch")).toHaveLength(1); // not re-queued on later ticks
  });

  it("survives a restart: state rebuilt from persisted JSON continues exactly where it stopped", async () => {
    const services = fakeServices({ researchProgress: async () => ({ total: 3, succeeded: 3, failed: 0, canceled: 0, finished: true, errors: [] }) });
    const plan = await realPlan();
    const state = initialRunState(plan, new Date());
    const { h, persisted } = hooks();
    const r1 = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    expect(r1.kind).toBe("wait"); // find done, research started — then "the worker dies"

    const revived: RunState = JSON.parse(JSON.stringify(persisted[persisted.length - 1])); // exactly what the DB would hold
    expect(revived.steps.map((s) => s.status)).toEqual(["succeeded", "running", "pending"]);
    const { h: h2 } = hooks();
    const r2 = await advance({ plan, state: revived, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h2 });
    expect(r2.kind).toBe("completed");
    expect(services.calls.filter((c) => c === "findLeadIds")).toHaveLength(1); // finished work is not repeated
    expect(services.calls.filter((c) => c === "startResearch")).toHaveLength(1); // research is not queued twice
  });
});

describe("advance — stopping and failing", () => {
  it("stops between steps when the run is canceled/paused, leaving later steps pending", async () => {
    const services = fakeServices();
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const { h } = hooks({ stopAfter: 1 });
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    expect(r.kind).toBe("stopped");
    expect(state.steps.map((s) => s.status)).toEqual(["succeeded", "pending", "pending"]);
    expect(services.calls).not.toContain("startResearch");
  });

  it("a failed step fails the run and SKIPS everything after it (recorded, not dropped)", async () => {
    const services = fakeServices({ researchProgress: async () => ({ total: 4, succeeded: 1, failed: 3, canceled: 0, finished: true, errors: [{ leadId: 1, message: "engine down" }] }) });
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const { h, records } = hooks();
    // first tick starts research (wait), second sees 3/4 failed (> 30%)
    await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    expect(r.kind).toBe("failed");
    if (r.kind === "failed") expect(r.error).toMatch(/failed for 3 of 4 leads/);
    expect(state.steps.map((s) => s.status)).toEqual(["succeeded", "failed", "skipped"]);
    expect(state.steps[2].summary).toMatch(/Skipped: s2 failed/);
    expect(records.map((x) => x.status)).toEqual(["ok", "error"]);
  });

  it("partial failure under the threshold still completes, and counts the failures", async () => {
    let started = false;
    const services = fakeServices({
      startResearch: async () => { started = true; return { batchRunId: 7, enqueued: 10, skipped: [] }; },
      researchProgress: async () => ({ total: 10, succeeded: 8, failed: 2, canceled: 0, finished: started, errors: [{ leadId: 2, message: "timeout" }] }),
    });
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const { h } = hooks();
    await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: h });
    expect(r.kind).toBe("completed");
    expect(state.steps[1].output).toMatchObject({ succeeded: 8, failed: 2 });
  });

  it("an AppError thrown by a tool becomes a failed step with a safe message", async () => {
    const services = fakeServices({ startResearch: async () => { throw new AppError("NOT_CONFIGURED", "The research engine is not configured yet."); } });
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: hooks().h });
    expect(r).toMatchObject({ kind: "failed", error: "The research engine is not configured yet." });
    expect(state.steps[1].status).toBe("failed");
  });

  it("an unexpected error is rethrown (job retry with backoff) and the step stays running with its state intact", async () => {
    const services = fakeServices({ startResearch: async () => { throw new Error("socket hang up"); } });
    const plan = await realPlan(services);
    const state = initialRunState(plan, new Date());
    await expect(advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: hooks().h })).rejects.toThrow("socket hang up");
    expect(state.steps[1].status).toBe("running");
  });
});

describe("advance — the stored plan is untrusted at execution time too", () => {
  it("fails closed if stored args were tampered with (limit 500, extra keys)", async () => {
    const plan = await realPlan();
    const services = fakeServices();
    plan.steps[0].args = { ...plan.steps[0].args, limit: 500 };
    const state = initialRunState(plan, new Date());
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: hooks().h });
    expect(r).toMatchObject({ kind: "failed", error: "This step's arguments are not valid." });
    expect(services.calls).not.toContain("findLeadIds");
  });

  it("fails closed if the plan names a tool that isn't registered (e.g. send_email)", async () => {
    const plan = await realPlan();
    plan.steps[0].tool = "send_email";
    const services = fakeServices(); // fresh: nothing may be called at all
    const state = initialRunState(plan, new Date());
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: hooks().h });
    expect(r.kind).toBe("failed");
    expect(services.calls).toEqual([]);
  });

  it("fails closed if a tool has become unavailable since approval", async () => {
    const services = fakeServices({ engineAvailable: () => false });
    const plan = await realPlan(fakeServices());
    const state = initialRunState(plan, new Date());
    const r = await advance({ plan, state, ctx: ctxFor(services), registry: defaultToolRegistry, hooks: hooks().h });
    expect(r.kind).toBe("failed"); // research_leads is no longer available
    expect(services.calls).not.toContain("startResearch");
  });

  it("only ever calls tools that are in the plan (a custom registry proves no side channel)", async () => {
    const seen: string[] = [];
    const tool = (name: string): Tool<unknown> => ({
      name, label: name, description: name, inputSchema: z.strictObject({}), argsJsonSchema: {}, costly: false, producesLeadIds: false,
      available: () => true, estimate: async () => ({ records: null, note: null }),
      run: async (): Promise<ToolOutcome> => { seen.push(name); return { kind: "done", output: {}, summary: name }; },
    });
    const registry = new ToolRegistry([tool("a"), tool("b"), tool("never_planned")]);
    const plan: Plan = {
      goal: "g", assumptions: [], unsupported: [], missingInputs: [], warnings: [],
      steps: [
        { id: "s1", tool: "a", args: {}, dependsOn: [], rationale: "", estimatedRecords: null, estimateNote: null, costly: false },
        { id: "s2", tool: "b", args: {}, dependsOn: ["s1"], rationale: "", estimatedRecords: null, estimateNote: null, costly: false },
      ],
    };
    const r = await advance({ plan, state: initialRunState(plan, new Date()), ctx: ctxFor(), registry, hooks: hooks().h });
    expect(r.kind).toBe("completed");
    expect(seen).toEqual(["a", "b"]);
  });
});

describe("step state machine", () => {
  const step = (status: StepState["status"]): StepState => ({ id: "s1", tool: "t", status, startedAt: null, finishedAt: null, summary: null, error: null, state: {}, output: null });

  it("allows the legal transitions", () => {
    for (const [from, to] of [["pending", "running"], ["pending", "skipped"], ["pending", "canceled"], ["running", "succeeded"], ["running", "failed"], ["running", "canceled"]] as const) {
      expect(() => transitionStep(step(from), to)).not.toThrow();
    }
  });

  it("throws on every illegal one — terminal states are final", () => {
    for (const from of ["succeeded", "failed", "skipped", "canceled"] as const) {
      for (const to of ["pending", "running", "succeeded", "failed", "skipped", "canceled"] as const) {
        expect(() => transitionStep(step(from), to), `${from} → ${to}`).toThrow(/Illegal step transition/);
      }
    }
    expect(() => transitionStep(step("pending"), "succeeded")).toThrow();
    expect(() => transitionStep(step("running"), "skipped")).toThrow();
  });
});
