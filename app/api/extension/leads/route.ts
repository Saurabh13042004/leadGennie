import { z } from "zod";
import { AppError, mapAiError, ok, parseJson, withApi } from "@/lib/api";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { insertLead } from "@/lib/db/leads-core";
import { extractLeadInfoFromPage } from "@/lib/ai/linkedin-personalize";

export const dynamic = "force-dynamic";

const Body = z.object({
  pageText: z.string().trim().min(1, "pageText is required").max(200_000),
  linkedin_url: z.string().trim().max(500).optional(),
});

export const POST = withApi(async (request) => {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) throw new AppError("UNAUTHENTICATED", "Unauthorized");

  const { pageText, linkedin_url } = await parseJson(request, Body);

  try {
    const extracted = await extractLeadInfoFromPage(pageText);
    const lead = await insertLead(
      auth.workspaceId,
      {
        full_name: extracted.full_name,
        job_title: extracted.job_title,
        company: extracted.company,
        linkedin_url,
      },
      "linkedin_extension"
    );
    return ok({ ...lead });
  } catch (err) {
    throw mapAiError(err);
  }
});
