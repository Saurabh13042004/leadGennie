import { AppError, ok } from "@/lib/api";
import { extensionRoute } from "@/lib/extension/route";
import { enqueueLeadResearch } from "@/lib/intelligence/service";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/leads/:id/research — "Research with Gennie". Queues the same background job as the dashboard
 * button; the extension only ever sees its status. Needs a signed-in person (research is attributed to a user), so
 * the older shared workspace token cannot start it.
 */
export const POST = extensionRoute<{ params: Promise<{ id: string }> }>({ scope: "research:trigger" }, async (_request, identity, _api, ctx) => {
  if (identity.userId === null) {
    throw new AppError("FORBIDDEN", "Reconnect the extension with your account to start research.");
  }
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid lead id.");
  const r = await enqueueLeadResearch({ workspaceId: identity.workspaceId, userId: identity.userId }, [id]);
  const skipped = r.skipped[0]?.reason ?? null;
  return ok({ agent_run_id: r.agentRunId, queued: r.enqueued.length > 0, skipped }, { status: 202 });
});
