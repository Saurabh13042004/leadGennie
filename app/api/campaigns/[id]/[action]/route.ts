import { AppError, ok, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { cancelCampaign, pauseCampaign, resumeCampaign } from "@/lib/domain/campaigns/lifecycle";

export const dynamic = "force-dynamic";

const ACTIONS = { pause: pauseCampaign, resume: resumeCampaign, cancel: cancelCampaign } as const;

/** POST /api/campaigns/:id/pause | resume | cancel. Agent tool: pauseCampaign. */
export const POST = withApi<{ params: Promise<{ id: string; action: string }> }>(async (_request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  const { id, action } = await ctx.params;
  const handler = ACTIONS[action as keyof typeof ACTIONS];
  if (!handler) throw new AppError("NOT_FOUND", "Unknown campaign action.");
  await handler({ workspaceId, userId }, parseId(id, "campaign id"));
  return ok({ status: action === "pause" ? "paused" : action === "resume" ? "running" : "canceled" });
});
