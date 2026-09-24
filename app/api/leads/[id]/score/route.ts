import { AppError, ok, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { enqueueRescoreLead } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

/** POST /api/leads/:id/score — re-score from stored, verified inputs against the current ICP (no re-research). */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid lead id.");
  const r = await enqueueRescoreLead({ workspaceId, userId }, id);
  return ok({ enqueued: r.enqueued }, { status: 202 });
});
