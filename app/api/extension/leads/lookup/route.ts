import { ok } from "@/lib/api";
import { findLeadByIdentity } from "@/lib/db/leads-lookup";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

/**
 * GET /api/extension/leads/lookup?linkedin_url=&email=&name=&company= — "is this person already a lead?"
 * The LinkedIn widget calls it on every profile page, so it is deliberately cheap and read-only.
 */
export const GET = extensionRoute({ scope: "leads:read" }, async (request, identity) => {
  const p = new URL(request.url).searchParams;
  const lead = await findLeadByIdentity(identity.workspaceId, {
    linkedinUrl: p.get("linkedin_url"), email: p.get("email"), fullName: p.get("name"), company: p.get("company"),
  });
  return ok({ found: lead !== null, lead });
});
