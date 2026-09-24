import { z } from "zod";
import { AppError, mapAiError, ok, parseJson, withApi } from "@/lib/api";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { generatePersonalizedLinkedinMessage } from "@/lib/ai/linkedin-personalize";

export const dynamic = "force-dynamic";

const Body = z.object({
  profileUrl: z.string().trim().min(1, "profileUrl is required").max(500),
  pageText: z.string().trim().min(1, "pageText is required").max(200_000),
  sdrContext: z.string().max(5_000).optional(),
  customPrompt: z.string().max(5_000).optional(),
});

export const POST = withApi(async (request) => {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) throw new AppError("UNAUTHENTICATED", "Unauthorized");

  const { profileUrl, pageText, sdrContext, customPrompt } = await parseJson(request, Body);

  try {
    const result = await generatePersonalizedLinkedinMessage(profileUrl, pageText, sdrContext, customPrompt);
    return ok({ ...result });
  } catch (err) {
    throw mapAiError(err);
  }
});
