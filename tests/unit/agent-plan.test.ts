import { describe, expect, it } from "vitest";
import { defaultToolRegistry } from "@/lib/agent/tools";
import { estimateSteps, isApprovable, validatePlan } from "@/lib/agent/plan";
import { MAX_LEADS_PER_RUN, MAX_PLAN_STEPS, type Plan } from "@/lib/agent/types";
import { draft, fakeServices, researchPlan } from "../helpers/agent";

const svc = fakeServices();
const check = (d: ReturnType<typeof draft>, s = svc) => validatePlan(d, defaultToolRegistry, s);
const problems = (d: ReturnType<typeof draft>, s = svc) => {
  const r = check(d, s);
  if (r.ok) throw new Error("expected the plan to be rejected");
  return r.problems.join(" | ");
};

describe("validatePlan", () => {
  it("accepts the canonical plan, strips model nulls, and makes `from` a dependency", () => {
    const r = check(researchPlan());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps.map((s) => s.tool)).toEqual(["find_leads", "research_leads", "rank_leads"]);
    expect(r.steps[0].args).toEqual({ research: "none", limit: 3 }); // nulls dropped
    expect(r.steps[1].costly).toBe(true);
    expect(r.steps[0].costly).toBe(false);

    const noDeps = draft([{ id: "s1", tool: "find_leads", args: { limit: 5 } }, { id: "s2", tool: "rank_leads", args: { from: "s1" }, dependsOn: [] }]);
    const r2 = check(noDeps);
    expect(r2.ok && r2.steps[1].dependsOn).toEqual(["s1"]); // model forgot dependsOn; `from` implies it
  });

  it("rejects an unknown tool and tells the model what IS available", () => {
    const p = problems(draft([{ id: "s1", tool: "send_email", args: {} }]));
    expect(p).toMatch(/"send_email" is not a tool you may use/);
    expect(p).toMatch(/find_leads, research_leads, rank_leads/);
  });

  it("rejects a tool that exists but is unavailable right now (engine not configured)", () => {
    const off = fakeServices({ engineAvailable: () => false });
    expect(problems(researchPlan(), off)).toMatch(/research_leads.*not available/);
  });

  it("rejects literal lead ids, workspace ids and any other extra key", () => {
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 5, leadIds: [1, 2] } }]))).toMatch(/invalid arguments/);
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 5 } }, { id: "s2", tool: "research_leads", args: { from: "s1", leadIds: [999] } }]))).toMatch(/invalid arguments/);
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 5, workspaceId: 2 } }]))).toMatch(/invalid arguments/);
  });

  it("rejects wrong types and out-of-range values", () => {
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 5, minScore: 150 } }]))).toMatch(/minScore/);
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: "many" } }]))).toMatch(/limit/);
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 5, research: "everything" } }]))).toMatch(/research/);
  });

  it("clamps an over-cap limit to the cap and WARNS instead of silently obeying or failing", () => {
    const r = check(draft([{ id: "s1", tool: "find_leads", args: { limit: 500 } }]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps[0].args.limit).toBe(MAX_LEADS_PER_RUN);
    expect(r.warnings.join(" ")).toMatch(/Limited to 50 leads per run \(you asked for 500\)/);
  });

  it("defaults a missing limit", () => {
    const r = check(draft([{ id: "s1", tool: "find_leads", args: {} }]));
    expect(r.ok && r.steps[0].args.limit).toBe(20);
  });

  it("puts steps into execution order itself: a valid plan written BACKWARDS still runs find → rank", () => {
    const r = check(draft([
      { id: "s1", tool: "rank_leads", args: { from: "s2", top: 3 }, dependsOn: ["s2"] },
      { id: "s2", tool: "find_leads", args: { research: "researched", limit: 20 } },
    ]));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.steps.map((s) => s.id)).toEqual(["s2", "s1"]);
    expect(r.steps.map((s) => s.tool)).toEqual(["find_leads", "rank_leads"]);
  });

  it("keeps the model's order when it is already valid (stable sort)", () => {
    const r = check(draft([
      { id: "s1", tool: "find_leads", args: { limit: 3 } },
      { id: "s2", tool: "find_leads", args: { limit: 4 } },
      { id: "s3", tool: "rank_leads", args: { from: "s1" } },
    ]));
    expect(r.ok && r.steps.map((s) => s.id)).toEqual(["s1", "s2", "s3"]);
  });

  it("rejects dependencies on steps that don't exist, self-references, and cycles", () => {
    expect(problems(draft([{ id: "s1", tool: "research_leads", args: { from: "s9" } }]))).toMatch(/s9, which is not a step in this plan/);
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 3 }, dependsOn: ["s1"] }]))).toMatch(/depends on itself/);
    expect(problems(draft([
      { id: "s1", tool: "find_leads", args: { limit: 3 }, dependsOn: ["s2"] },
      { id: "s2", tool: "rank_leads", args: { from: "s1" } },
    ]))).toMatch(/depend on each other in a cycle/);
  });

  it("rejects using a step that produces no leads as a lead list", () => {
    expect(problems(draft([
      { id: "s1", tool: "find_leads", args: { limit: 3 } },
      { id: "s2", tool: "rank_leads", args: { from: "s1" } },
      { id: "s3", tool: "research_leads", args: { from: "s2" } },
    ]))).toMatch(/does not produce leads/);
  });

  it("rejects duplicate step ids and oversized plans", () => {
    expect(problems(draft([{ id: "s1", tool: "find_leads", args: { limit: 3 } }, { id: "s1", tool: "find_leads", args: { limit: 3 } }]))).toMatch(/used more than once/);
    const many = Array.from({ length: MAX_PLAN_STEPS + 1 }, (_, i) => ({ id: `s${i + 1}`, tool: "find_leads", args: { limit: 1 } }));
    expect(problems(draft(many))).toMatch(/at most 6 steps/);
  });
});

describe("estimateSteps", () => {
  it("derives estimates from the database, propagating through `from`", async () => {
    const r = check(researchPlan(5));
    if (!r.ok) throw new Error("invalid");
    const steps = await estimateSteps(r.steps, defaultToolRegistry, { workspaceId: 1, services: fakeServices({ countLeads: async () => 12 }) });
    expect(steps.map((s) => s.estimatedRecords)).toEqual([5, 5, 3]); // min(12, limit 5) → research inherits → rank min(5, top 3)
    expect(steps[0].estimateNote).toMatch(/12 match; the first 5 are used/);
    expect(steps[1].estimateNote).toMatch(/30 seconds per lead/);
  });

  it("says so when nothing matches", async () => {
    const r = check(draft([{ id: "s1", tool: "find_leads", args: { limit: 5 } }]));
    if (!r.ok) throw new Error("invalid");
    const [s] = await estimateSteps(r.steps, defaultToolRegistry, { workspaceId: 1, services: fakeServices({ countLeads: async () => 0 }) });
    expect(s.estimatedRecords).toBe(0);
    expect(s.estimateNote).toMatch(/No leads match/);
  });
});

describe("isApprovable", () => {
  const plan = (over: Partial<Plan>): Plan => ({ goal: "g", steps: [], assumptions: [], unsupported: [], missingInputs: [], warnings: [], ...over });
  const step = { id: "s1", tool: "find_leads", args: {}, dependsOn: [], rationale: "", estimatedRecords: 1, estimateNote: null, costly: false };
  it("needs steps and no open questions", () => {
    expect(isApprovable(plan({}))).toBe(false);
    expect(isApprovable(plan({ steps: [step] }))).toBe(true);
    expect(isApprovable(plan({ steps: [step], missingInputs: [{ key: "k", question: "?" }] }))).toBe(false);
  });
});
