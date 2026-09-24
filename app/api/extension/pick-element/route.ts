import { z } from "zod";
import { AppError, mapAiError, ok, parseJson, withApi } from "@/lib/api";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";
import { pickLinkedInElement } from "@/lib/ai/linkedin-element-picker";

export const dynamic = "force-dynamic";

const MAX_CANDIDATES = 60;

const Body = z.object({
  candidates: z
    .array(
      z.object({
        index: z.number().int(),
        tag: z.string().max(40),
        text: z.string().max(500),
        ariaLabel: z.string().max(500),
        href: z.string().max(1000),
      })
    )
    .min(1, "candidates is required"),
  taskDescription: z.string({ error: "taskDescription is required" }).trim().min(1, "taskDescription is required").max(1_000),
});

export const POST = withApi(async (request) => {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) throw new AppError("UNAUTHENTICATED", "Unauthorized");

  const { candidates, taskDescription } = await parseJson(request, Body);

  try {
    const result = await pickLinkedInElement(candidates.slice(0, MAX_CANDIDATES), taskDescription);
    return ok({ ...result });
  } catch (err) {
    throw mapAiError(err);
  }
});
