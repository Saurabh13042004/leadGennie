import { z } from "zod";
import { Type } from "@/lib/ai/llm-types";
import { MAX_LEADS_PER_RUN } from "@/lib/agent/types";
import type { Tool } from "./types";

const inputSchema = z.strictObject({
  search: z.string().trim().min(1).max(100).optional(),
  stage: z.string().trim().min(1).max(50).optional(),
  research: z.enum(["none", "researched", "failed"]).optional(),
  minScore: z.number().int().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(MAX_LEADS_PER_RUN),
});
type Input = z.infer<typeof inputSchema>;

const filterOf = (i: Input) => ({ search: i.search, stage: i.stage, research: i.research, minScore: i.minScore });

/** Read-only: selects from the workspace's EXISTING leads. It cannot create, import or discover prospects. */
export const findLeadsTool: Tool<Input> = {
  name: "find_leads",
  label: "Find leads",
  description:
    "Select leads the user ALREADY HAS, optionally filtered. Read-only. Cannot find new prospects. " +
    "Filters: search (matches name, email, company or job title), stage, research (none = not yet researched, researched, failed), minScore (0-100 ICP score; only researched leads have one), limit (max " +
    `${MAX_LEADS_PER_RUN}, default 20). Returns a lead list that later steps can use via "from".`,
  inputSchema,
  argsJsonSchema: {
    search: { type: Type.STRING, description: "Text to match in lead name, email, company or job title." },
    stage: { type: Type.STRING, description: "Lead stage, e.g. new." },
    research: { type: Type.STRING, description: "Research state filter: none | researched | failed." },
    minScore: { type: Type.INTEGER, description: "Only leads with ICP score at least this (0-100)." },
    limit: { type: Type.INTEGER, description: `How many leads (1-${MAX_LEADS_PER_RUN}). Default 20.` },
  },
  costly: false,
  producesLeadIds: true,
  available: () => true,
  normalizeArgs(args) {
    const warnings: string[] = [];
    const next = { ...args };
    if (next.limit === undefined) next.limit = 20;
    if (typeof next.limit === "number" && next.limit > MAX_LEADS_PER_RUN) {
      warnings.push(`Limited to ${MAX_LEADS_PER_RUN} leads per run (you asked for ${next.limit}).`);
      next.limit = MAX_LEADS_PER_RUN;
    }
    return { args: next, warnings };
  },
  async estimate({ workspaceId, services }, input) {
    const matching = await services.countLeads(workspaceId, filterOf(input));
    const records = Math.min(matching, input.limit);
    return { records, note: matching === 0 ? "No leads match this filter." : matching > input.limit ? `${matching} match; the first ${input.limit} are used.` : null };
  },
  async run(ctx, input) {
    const { leadIds, total } = await ctx.services.findLeadIds(ctx.workspaceId, filterOf(input), input.limit);
    return {
      kind: "done",
      output: { leadIds, total },
      summary: leadIds.length === 0 ? "No leads matched." : `Selected ${leadIds.length} of ${total} matching lead${total === 1 ? "" : "s"}.`,
    };
  },
};
