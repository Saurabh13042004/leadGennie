import { z } from "zod";
import { Type } from "@/lib/ai/llm-types";
import { fromSchema, leadIdsFrom } from "./lead-refs";
import type { Tool } from "./types";

const inputSchema = z.strictObject({ from: fromSchema, top: z.number().int().min(1).max(10).default(5) });
type Input = z.infer<typeof inputSchema>;

/** Read-only: orders leads by the ICP score the research engine already computed. It never scores anything itself. */
export const rankLeadsTool: Tool<Input> = {
  name: "rank_leads",
  label: "Rank by ICP score",
  description:
    "Show the best leads from an earlier step, ordered by their existing ICP score (read-only; only researched leads have a score). " +
    "Arguments: from = id of an earlier step that produced leads, top = how many to show (1-10, default 5).",
  inputSchema,
  argsJsonSchema: {
    from: { type: Type.STRING, description: "Id of the earlier step that produced the leads, e.g. s1 or s2." },
    top: { type: Type.INTEGER, description: "How many to show (1-10). Default 5." },
  },
  costly: false,
  producesLeadIds: false,
  available: () => true,
  normalizeArgs(args) {
    const next = { ...args };
    if (typeof next.top === "number") next.top = Math.max(1, Math.min(10, Math.trunc(next.top)));
    return { args: next, warnings: [] };
  },
  async estimate(_ctx, input, deps) {
    const from = deps[input.from];
    return { records: from === null || from === undefined ? null : Math.min(from, input.top), note: null };
  },
  async run(ctx, input, { deps }) {
    const leadIds = leadIdsFrom(deps, input.from);
    if (leadIds === null) return { kind: "failed", error: `Step ${input.from} did not produce a lead list.` };
    const ranked = await ctx.services.rankLeads(ctx.workspaceId, leadIds, input.top);
    const scored = ranked.filter((r) => r.icpScore !== null).length;
    return {
      kind: "done",
      output: { ranked, considered: leadIds.length },
      summary: ranked.length === 0 ? "No leads to rank." : `Ranked ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}; ${scored} ${scored === 1 ? "has" : "have"} an ICP score.`,
    };
  },
};
