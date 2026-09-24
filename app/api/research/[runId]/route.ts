import { AppError, ok, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { getResearchProgress } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

/** GET /api/research/:runId — progress of a research batch, derived from its jobs. */
export const GET = withApi<{ params: Promise<{ runId: string }> }>(async (_request, ctx) => {
  const { workspaceId } = await requireRole("viewer");
  const id = Number((await ctx.params).runId);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid run id.");
  return ok({ progress: await getResearchProgress(workspaceId, id) });
});
