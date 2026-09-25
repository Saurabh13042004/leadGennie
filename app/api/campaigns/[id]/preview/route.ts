import { ok, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { previewForLead } from "@/lib/domain/campaigns/preview";

export const dynamic = "force-dynamic";

/** GET /api/campaigns/:id/preview?leadId= — exactly what that lead receives, every step. Agent tool: previewCampaign. */
export const GET = withApi<{ params: Promise<{ id: string }> }>(async (request, ctx) => {
  const { workspaceId } = await requireRole("viewer");
  const leadId = parseId(new URL(request.url).searchParams.get("leadId"), "leadId");
  return ok(await previewForLead(workspaceId, parseId((await ctx.params).id, "campaign id"), leadId));
});
