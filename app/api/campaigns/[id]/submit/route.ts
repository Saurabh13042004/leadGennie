import { ok, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { submitForApproval } from "@/lib/domain/campaigns/lifecycle";
import { toReadinessView } from "@/lib/domain/campaigns/views";

export const dynamic = "force-dynamic";

/** POST /api/campaigns/:id/submit — request owner/admin approval. Agent tool: scheduleCampaign (it can never approve). */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  const r = await submitForApproval({ workspaceId, userId }, parseId((await ctx.params).id, "campaign id"));
  return ok({ approval_id: r.approvalId, status: "pending_approval", readiness: toReadinessView(r.readiness) }, { status: 202 });
});
