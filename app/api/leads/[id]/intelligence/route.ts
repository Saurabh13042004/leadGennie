import { AppError, ok, withApi } from "@/lib/api";
import { requireRole } from "@/lib/auth/workspace-context";
import { getLeadIntelligence } from "@/lib/intelligence/read-model";

export const dynamic = "force-dynamic";

/** GET /api/leads/:id/intelligence — research, verified signals, evidence and score for one lead. */
export const GET = withApi<{ params: Promise<{ id: string }> }>(async (_request, ctx) => {
  const { workspaceId } = await requireRole("viewer");
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid lead id.");
  const intel = await getLeadIntelligence(workspaceId, id);
  if (!intel) throw new AppError("NOT_FOUND", "Lead not found.");
  return ok({ intelligence: intel });
});
