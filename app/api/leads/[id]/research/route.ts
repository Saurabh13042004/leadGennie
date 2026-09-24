import { AppError, ok, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { enqueueLeadResearch } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

/** POST /api/leads/:id/research — queue research for one lead (returns 202; the work is a background job). */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid lead id.");
  const r = await enqueueLeadResearch({ workspaceId, userId }, [id]);
  return ok({ agent_run_id: r.agentRunId, enqueued: r.enqueued, skipped: r.skipped }, { status: 202 });
});
