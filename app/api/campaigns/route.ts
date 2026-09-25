import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { listCampaignItems } from "@/lib/domain/campaigns/read-model";
import { createDraftCampaign } from "@/lib/domain/campaigns/service";

export const dynamic = "force-dynamic";

/** GET /api/campaigns — campaigns with real counts only. */
export const GET = withApi(async () => {
  const { workspaceId } = await requireRole("viewer");
  return ok({ campaigns: await listCampaignItems(workspaceId) });
});

const body = z.object({ name: z.string().max(200), workflow_id: z.number().int().positive().nullable().optional() });

/** POST /api/campaigns — create a draft (default 4-step email cadence). Agent tool: createCampaign. */
export const POST = withApi(async (request) => {
  const { workspaceId, userId } = await requireRole("member");
  const { name, workflow_id } = await parseJson(request, body);
  const id = await createDraftCampaign({ workspaceId, userId }, { name, workflowId: workflow_id ?? null });
  return ok({ id, status: "draft" }, { status: 201 });
});
