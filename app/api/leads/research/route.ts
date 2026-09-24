import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { enqueueLeadResearch } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

const body = z.object({ lead_ids: z.array(z.number().int().positive()).min(1).max(200) });

/** POST /api/leads/research — research several leads (cap enforced by the service). */
export const POST = withApi(async (request) => {
  const { workspaceId, userId } = await requireRole("member");
  const { lead_ids } = await parseJson(request, body);
  const r = await enqueueLeadResearch({ workspaceId, userId }, lead_ids);
  return ok({ agent_run_id: r.agentRunId, enqueued: r.enqueued, skipped: r.skipped }, { status: 202 });
});
