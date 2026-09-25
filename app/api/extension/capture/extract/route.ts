import { ok, parseJson } from "@/lib/api";
import { extractCandidate } from "@/lib/domain/capture/service";
import { pageFactsSchema } from "@/lib/domain/capture/schemas";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/capture/extract — page facts in, a proposed lead out. Writes nothing: the person reviews
 * (and can edit) the card, then POST /api/extension/leads saves it. `existing` is set when they're already a lead.
 */
export const POST = extensionRoute({ scope: "leads:create", expensivePerMinute: 30 }, async (request, identity) => {
  const facts = await parseJson(request, pageFactsSchema);
  const { candidate, existing } = await extractCandidate({ workspaceId: identity.workspaceId, userId: identity.userId }, facts);
  return ok({ candidate, existing });
});
