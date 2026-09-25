import { z } from "zod";
import { ok, parseJson, withApi } from "@/lib/api";
import { parseId } from "@/lib/api/params";
import { requireRole } from "@/lib/auth/workspace-context";
import { getCampaignDetail } from "@/lib/domain/campaigns/read-model";
import { checkReadiness } from "@/lib/domain/campaigns/readiness";
import { loadCampaign } from "@/lib/domain/campaigns/repository";
import { updateAudience, updateBasics, updateSteps } from "@/lib/domain/campaigns/service";
import { toReadinessView } from "@/lib/domain/campaigns/views";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** GET /api/campaigns/:id — campaign, approval, per-lead state, activity. */
export const GET = withApi<Ctx>(async (_request, ctx) => {
  const { workspaceId } = await requireRole("viewer");
  return ok(await getCampaignDetail(workspaceId, parseId((await ctx.params).id, "campaign id")));
});

const patch = z.object({ basics: z.unknown().optional(), audience: z.unknown().optional(), steps: z.array(z.unknown()).optional() }).strict();

/** PATCH /api/campaigns/:id — any of { basics, audience, steps }; returns the campaign + readiness checklist. */
export const PATCH = withApi<Ctx>(async (request, ctx) => {
  const { workspaceId, userId } = await requireRole("member");
  const id = parseId((await ctx.params).id, "campaign id");
  const body = await parseJson(request, patch);
  const actor = { workspaceId, userId };
  if (body.basics !== undefined) await updateBasics(actor, id, body.basics);
  if (body.audience !== undefined) await updateAudience(actor, id, body.audience);
  if (body.steps !== undefined) await updateSteps(actor, id, body.steps);
  const campaign = await loadCampaign(workspaceId, id);
  return ok({ campaign, readiness: toReadinessView(await checkReadiness(workspaceId, campaign)) });
});
