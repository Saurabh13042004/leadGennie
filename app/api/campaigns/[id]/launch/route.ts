import { ok, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { launchCampaign } from "@/lib/domain/campaigns/lifecycle";

export const dynamic = "force-dynamic";

/** POST /api/campaigns/:id/launch — only after an approved approval; enrolls leads and schedules their sends. */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  return ok(await launchCampaign({ workspaceId, userId }, parseId((await ctx.params).id, "campaign id")));
});
