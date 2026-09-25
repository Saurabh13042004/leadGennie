import { AppError, fromZodError, ok, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { resolveAudience } from "@/lib/domain/campaigns/audience";
import { loadCampaign } from "@/lib/domain/campaigns/repository";
import { audienceDefinitionSchema } from "@/lib/domain/campaigns/types";
import { toAudienceView } from "@/lib/domain/campaigns/views";

export const dynamic = "force-dynamic";

/** POST /api/campaigns/:id/audience/resolve — counts + exclusions per reason. Body: a definition, or empty for the saved one. */
export const POST = withApi<{ params: Promise<{ id: string }> }>(async (request, ctx) => {
  const { workspaceId } = await requireRole("viewer");
  const id = parseId((await ctx.params).id, "campaign id");
  const text = await request.text();
  let def = (await loadCampaign(workspaceId, id)).audience;
  if (text.trim()) {
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
    }
    const parsed = audienceDefinitionSchema.safeParse(raw);
    if (!parsed.success) throw fromZodError(parsed.error);
    def = parsed.data;
  }
  return ok(toAudienceView(await resolveAudience(workspaceId, def, { excludeCampaignId: id })));
});
