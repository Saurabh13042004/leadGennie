import { AppError, ok } from "@/lib/api";
import { getLeadRef } from "@/lib/db/leads-lookup";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

/** GET /api/extension/leads/:id — one lead's current state (stage, research status, ICP score) for the popup. */
export const GET = extensionRoute<{ params: Promise<{ id: string }> }>({ scope: "leads:read" }, async (_request, identity, _api, ctx) => {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) throw new AppError("BAD_REQUEST", "Invalid lead id.");
  const lead = await getLeadRef(identity.workspaceId, id);
  if (!lead) throw new AppError("NOT_FOUND", "Lead not found.");
  return ok({ lead });
});
