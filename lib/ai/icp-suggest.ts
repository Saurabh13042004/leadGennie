import { z } from "zod";
import { generateObject, Type, type LlmCallOptions } from "@/lib/ai/client";

/**
 * "Keywords that signal fit" for the ICP form, proposed from what the workspace says it sells. The model PROPOSES;
 * `cleanKeywords` DISPOSES — nothing is saved until the person reads the list and clicks Save, and role words that belong
 * in "Target titles" are dropped here so they can't end up in the evidence-matching list.
 */

export const MAX_SUGGESTED_KEYWORDS = 8;

export type IcpSuggestInput = { positioning: string; companyName: string; industries: string[]; titles: string[] };

const SCHEMA = {
  type: Type.OBJECT,
  properties: { keywords: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ["keywords"],
};

const parser = z.object({ keywords: z.array(z.string().max(200)).max(40) });

/** Words that name who someone is, not a company signal — those are matched against the person's title elsewhere. ("hiring engineers" is a company signal and stays.) */
const ROLE_WORD = /\b(ceo|cto|cfo|coo|cmo|cio|founder|co-?founder|owner|president|vp|vice president|head of|sdr|bdr)\b/i;

/** Trim, drop empties/duplicates/role words/anything already a target title, cap the length and the count. Order kept. */
export function cleanKeywords(raw: string[], titles: string[] = []): string[] {
  const titleSet = new Set(titles.map((t) => t.trim().toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const k = item.replace(/\s+/g, " ").trim().replace(/^[-•*\d.)\s]+/, "").toLowerCase();
    if (k.length < 2 || k.length > 40 || seen.has(k) || titleSet.has(k) || ROLE_WORD.test(k)) continue;
    seen.add(k);
    out.push(k);
    if (out.length === MAX_SUGGESTED_KEYWORDS) break;
  }
  return out;
}

export type IcpKeywordProposer = (input: IcpSuggestInput, opts?: LlmCallOptions) => Promise<string[]>;

export const proposeIcpKeywords: IcpKeywordProposer = async (input, opts) => {
  const prompt = `You help a small company decide which words on a prospect company's public web pages, job listings and news show that the prospect is a good fit for what we sell.

What we sell${input.companyName ? ` (${input.companyName})` : ""}:
${input.positioning.slice(0, 2000)}
${input.industries.length ? `\nIndustries we target: ${input.industries.slice(0, 10).join(", ")}` : ""}${input.titles.length ? `\nPeople we contact (do NOT output job titles like these): ${input.titles.slice(0, 10).join(", ")}` : ""}

Return up to ${MAX_SUGGESTED_KEYWORDS} short keywords or phrases (1–3 words, lowercase) that a company which NEEDS what we sell would plausibly mention about ITSELF: its product, its tech, the problem it is working on, or a hiring/growth signal (e.g. "hiring engineers", "mobile app", "cloud migration").
Rules: no job titles or seniority words, no company names, no generic filler like "innovation" or "solutions". Base every keyword on the text above — do not invent facts about us.`;

  const r = await generateObject(prompt, SCHEMA, parser, opts);
  return cleanKeywords(r.keywords, input.titles);
};
