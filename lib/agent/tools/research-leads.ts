import { z } from "zod";
import { Type } from "@/lib/ai/llm-types";
import { MAX_STEP_FAILURE_RATIO } from "@/lib/agent/types";
import { fromSchema, leadIdsFrom } from "./lead-refs";
import type { Tool } from "./types";

const inputSchema = z.strictObject({ from: fromSchema });
type Input = z.infer<typeof inputSchema>;

const POLL_SECONDS = 8;

/**
 * Runs the Intelligence Engine on the selected leads: verified company facts, buying signals with evidence, and
 * an ICP score. Costs AI/search budget, so it is badged in the plan. Takes leads ONLY from an earlier step
 * (`from`) — a model-written lead id has no way in.
 */
export const researchLeadsTool: Tool<Input> = {
  name: "research_leads",
  label: "Research leads",
  description:
    "Research the leads chosen by an earlier step with the research engine: verified company facts, buying signals with evidence, and an ICP score. " +
    "Costs AI/research budget and takes a while (about 30 s per lead, in the background). Use ONLY when the user asks to research, qualify or score leads. Argument: from = id of an earlier find_leads step.",
  inputSchema,
  argsJsonSchema: { from: { type: Type.STRING, description: "Id of the earlier step that selected the leads, e.g. s1." } },
  costly: true,
  producesLeadIds: true,
  available: (services) => services.engineAvailable(),
  unavailableNote: "the research engine is not configured",
  async estimate(_ctx, input, deps) {
    const records = deps[input.from] ?? null;
    return { records, note: records === null ? null : "About 30 seconds per lead, running in the background." };
  },
  async run(ctx, input, { state, deps }) {
    const leadIds = leadIdsFrom(deps, input.from);
    if (leadIds === null) return { kind: "failed", error: `Step ${input.from} did not produce a lead list.` };
    if (leadIds.length === 0) return { kind: "done", output: { leadIds: [], batchRunId: null }, summary: "No leads to research." };

    let batchRunId = typeof state.batchRunId === "number" ? state.batchRunId : null;
    let skipped = Array.isArray(state.skipped) ? (state.skipped as { leadId: number; reason: string }[]) : [];

    if (batchRunId === null) {
      // Crash recovery: the batch may have been created before the previous tick could save it.
      batchRunId = await ctx.services.existingResearchBatch(ctx.workspaceId, ctx.runId);
      const existing = batchRunId === null ? null : await ctx.services.researchProgress(ctx.workspaceId, batchRunId);
      if (batchRunId === null || existing?.total === 0) {
        const started = await ctx.services.startResearch({ workspaceId: ctx.workspaceId, userId: ctx.userId }, leadIds, ctx.runId);
        batchRunId = started.batchRunId;
        skipped = started.skipped;
        if (batchRunId === null || started.enqueued === 0) {
          return { kind: "done", output: { leadIds, batchRunId, skipped, total: 0, succeeded: 0, failed: 0 }, summary: "Nothing new to research (all leads were skipped)." };
        }
      }
      return { kind: "wait", afterSeconds: POLL_SECONDS, state: { batchRunId, skipped }, summary: `Researching ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}…` };
    }

    const p = await ctx.services.researchProgress(ctx.workspaceId, batchRunId);
    if (!p.finished) {
      return { kind: "wait", afterSeconds: POLL_SECONDS, state: { batchRunId, skipped }, summary: `Researched ${p.succeeded + p.failed + p.canceled} of ${p.total}…` };
    }
    const output = { leadIds, batchRunId, skipped, total: p.total, succeeded: p.succeeded, failed: p.failed, canceled: p.canceled, errors: p.errors };
    if (p.total > 0 && p.failed / p.total > MAX_STEP_FAILURE_RATIO) {
      return { kind: "failed", error: `Research failed for ${p.failed} of ${p.total} leads${p.errors[0] ? ` (${p.errors[0].message})` : ""}.`, output };
    }
    return { kind: "done", output, summary: `Researched ${p.succeeded} of ${p.total} lead${p.total === 1 ? "" : "s"}${p.failed ? `; ${p.failed} failed` : ""}.` };
  },
};
