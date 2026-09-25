import { z } from "zod";
import { ok, parseJson } from "@/lib/api";
import { suggestForCard } from "@/lib/domain/capture/suggest";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

const body = z.object({
  full_name: z.string().trim().max(200).nullish(),
  company: z.string().trim().max(200).nullish(),
  company_domain: z.string().trim().max(253).nullish(),
});

/**
 * POST /api/extension/capture/suggest — auto-generated email suggestions (and, if the website is unknown, website guesses)
 * for the capture card. Read-only and clearly a GUESS: nothing is stored, and the card labels every suggestion as such.
 */
export const POST = extensionRoute({ scope: "leads:create", expensivePerMinute: 90 }, async (request, identity) => {
  const b = await parseJson(request, body);
  const s = await suggestForCard(identity.workspaceId, { fullName: b.full_name, company: b.company, companyDomain: b.company_domain });
  return ok({ emails: s.emails, domain_guesses: s.domainGuesses, note: s.note });
});
