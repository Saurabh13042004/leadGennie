import { z } from "zod";
import { mapAiError, ok, parseJson } from "@/lib/api";
import { extensionRoute } from "@/lib/extension/route";
import { generatePersonalizedLinkedinMessage } from "@/lib/ai/linkedin-personalize";

export const dynamic = "force-dynamic";

const Body = z.object({
  profileUrl: z.string({ error: "profileUrl is required" }).trim().min(1, "profileUrl is required").max(500),
  pageText: z.string({ error: "pageText is required" }).trim().min(1, "pageText is required").max(200_000),
  sdrContext: z.string().max(5_000).optional(),
  customPrompt: z.string().max(5_000).optional(),
});

/** LinkedIn connection-note drafting is part of the LinkedIn automation feature (D-05): needs the `automation` scope. */
export const POST = extensionRoute({ scope: "automation", expensivePerMinute: 20 }, async (request) => {

  const { profileUrl, pageText, sdrContext, customPrompt } = await parseJson(request, Body);

  try {
    const result = await generatePersonalizedLinkedinMessage(profileUrl, pageText, sdrContext, customPrompt);
    return ok({ ...result });
  } catch (err) {
    throw mapAiError(err);
  }
});
