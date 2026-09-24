import type { AgentServices } from "@/lib/agent/tools";
import { countLeadsMatching, findLeadIdsMatching, findResearchBatchOf, rankLeads } from "@/lib/db/gennie";
import { isIntelligenceConfigured } from "@/lib/intelligence/client";
import { enqueueLeadResearch, getResearchProgress } from "@/lib/intelligence/service";

/**
 * The real implementation of the agent's ports. Every method is workspace-scoped by construction: the workspace
 * id is passed by the server (from the session), never read from a plan or from model output.
 */
export function createAgentServices(): AgentServices {
  return {
    engineAvailable: () => isIntelligenceConfigured(),
    countLeads: countLeadsMatching,
    findLeadIds: findLeadIdsMatching,
    existingResearchBatch: findResearchBatchOf,
    rankLeads,

    async startResearch(actor, leadIds, parentRunId) {
      const r = await enqueueLeadResearch({ ...actor, parentRunId }, leadIds);
      return { batchRunId: r.agentRunId, enqueued: r.enqueued.length, skipped: r.skipped };
    },

    async researchProgress(workspaceId, batchRunId) {
      const p = await getResearchProgress(workspaceId, batchRunId);
      return { total: p.total, succeeded: p.succeeded, failed: p.failed, canceled: p.canceled, finished: p.finished, errors: p.errors };
    },
  };
}
