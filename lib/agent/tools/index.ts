import { findLeadsTool } from "./find-leads";
import { rankLeadsTool } from "./rank-leads";
import { researchLeadsTool } from "./research-leads";
import { ToolRegistry } from "./registry";

export { ToolRegistry } from "./registry";
export type { AgentServices, LeadFilter, RankedLead, Tool, ToolCtx, ToolOutcome } from "./types";

/**
 * Every tool Gennie has today. Deliberately absent (Phase 8 later): send/schedule email, create campaigns, discover
 * new prospects, edit or delete anything. `tests/unit/agent-registry.test.ts` asserts none of them sneak in.
 */
export const defaultToolRegistry = new ToolRegistry([findLeadsTool, researchLeadsTool, rankLeadsTool]);
