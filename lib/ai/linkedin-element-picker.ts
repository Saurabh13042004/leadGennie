import { generateJson, Type } from "@/lib/ai/gemini";

export type ClickableCandidate = {
  index: number;
  tag: string;
  text: string;
  ariaLabel: string;
  href: string;
};

export type ElementPickResult = {
  index: number | null;
  reason: string;
};

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    index: { type: Type.INTEGER, nullable: true },
    reason: { type: Type.STRING },
  },
  required: ["reason"],
};

/**
 * Last-resort fallback when deterministic selector matching can't find or
 * confidently disambiguate the right element (see [[leadgennie-linkedin-dm-
 * debugging-chain]] — five rounds of pattern-guessing still couldn't locate
 * the real "Message" trigger on a real profile). Rather than add a sixth
 * selector guess, hand Gemini the actual list of clickable elements the page
 * rendered and let it reason about which one matches the task semantically
 * — the same way a human visually distinguishes "the profile's own action
 * button" from "a sidebar suggestion card for someone else." Deliberately
 * only called as a fallback, not on every send, since it costs a real
 * Gemini quota unit each time.
 */
export async function pickLinkedInElement(
  candidates: ClickableCandidate[],
  taskDescription: string
): Promise<ElementPickResult> {
  const prompt = `You are looking at a list of clickable elements (buttons/links) extracted from a LinkedIn web page, each with an "index" you must reference in your answer.

Task: ${taskDescription}

Only pick an element if you are genuinely confident it matches the task. Do not guess if multiple elements look equally plausible or if none clearly fit — return null for "index" in that case and explain why in "reason".

Elements:
${JSON.stringify(candidates, null, 2)}`;

  const result = await generateJson<{ index?: number | null; reason?: string }>(prompt, SCHEMA);
  return {
    index: typeof result.index === "number" ? result.index : null,
    reason: result.reason ?? "",
  };
}
