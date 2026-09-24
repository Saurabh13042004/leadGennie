import type { AgentServices } from "@/lib/agent/tools";

/** In-memory AgentServices for unit tests; every method is overridable and records nothing it shouldn't. */
export function fakeServices(over: Partial<AgentServices> = {}): AgentServices & { calls: string[] } {
  const calls: string[] = [];
  const track = <T extends unknown[], R>(name: string, fn: (...a: T) => Promise<R>) => async (...a: T) => {
    calls.push(name);
    return fn(...a);
  };
  return {
    calls,
    engineAvailable: () => true,
    countLeads: track("countLeads", async () => 7),
    findLeadIds: track("findLeadIds", async (_ws: number, _f: unknown, limit: number) => ({ leadIds: [1, 2, 3].slice(0, limit), total: 7 })),
    startResearch: track("startResearch", async (_a: unknown, ids: number[]) => ({ batchRunId: 900, enqueued: ids.length, skipped: [] })),
    existingResearchBatch: track("existingResearchBatch", async () => null),
    researchProgress: track("researchProgress", async () => ({ total: 3, succeeded: 3, failed: 0, canceled: 0, finished: true, errors: [] })),
    rankLeads: track("rankLeads", async (_ws: number, ids: number[], top: number) =>
      ids.slice(0, top).map((leadId) => ({ leadId, name: `Lead ${leadId}`, company: null, title: null, icpScore: 80 - leadId, intentScore: 10, qualified: true, researchStatus: "done", signalTypes: [] }))),
    ...over,
  };
}

const NO_ARGS = { search: null, stage: null, research: null, minScore: null, limit: null, from: null, top: null };

/** A model-shaped plan draft (nulls for unused args, as the strict schema forces). */
export function draft(steps: { id: string; tool: string; args?: Record<string, unknown>; dependsOn?: string[] }[], extra: Partial<{ goal: string; assumptions: string[]; unsupported: string[]; missingInputs: { key: string; question: string }[] }> = {}) {
  return {
    goal: extra.goal ?? "Test goal",
    steps: steps.map((s) => ({ id: s.id, tool: s.tool, args: { ...NO_ARGS, ...(s.args ?? {}) }, dependsOn: s.dependsOn ?? [], rationale: "because" })),
    assumptions: extra.assumptions ?? [],
    unsupported: extra.unsupported ?? [],
    missingInputs: extra.missingInputs ?? [],
  };
}

/** The canonical research plan: find unresearched leads → research → rank. */
export const researchPlan = (limit = 3) =>
  draft([
    { id: "s1", tool: "find_leads", args: { research: "none", limit } },
    { id: "s2", tool: "research_leads", args: { from: "s1" }, dependsOn: ["s1"] },
    { id: "s3", tool: "rank_leads", args: { from: "s2", top: 3 }, dependsOn: ["s2"] },
  ], { goal: "Research my newest unresearched leads and rank them" });
