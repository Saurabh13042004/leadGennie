import type { Tone } from "./types";

/** Real, prompt-level tone rules (not a label). Kept as data so tests can assert every tone changes the prompt. */
export const TONE_GUIDANCE: Record<Tone, string> = {
  concise: "Tone: concise. At most 70 words: 3–4 short sentences, plain words, no filler. A busy executive reads it in 15 seconds.",
  friendly: "Tone: friendly. Warm and conversational: use at least two contractions (I'd, you're, we've, it's) and a light human touch — never gushing, never jokes about the recipient.",
  formal: "Tone: formal. Professional and measured, full sentences, no contractions, no slang, no exclamation marks.",
  direct: "Tone: direct. The first sentence after the greeting is under 20 words and states the point. Then the value, plainly, then one clear question. No small talk.",
};

const SENIORITY_PATTERNS: [RegExp, string][] = [
  [/\b(c[a-z]{1,2}o|chief|founder|co-?founder|owner|president|managing director)\b/i, "The recipient is a top executive: be brief, lead with business outcomes, make it easy to say no."],
  [/\b(vp|vice president|head of|director|svp|evp)\b/i, "The recipient is a senior leader: focus on the team-level outcome, not features."],
  [/\b(manager|lead|principal|senior)\b/i, "The recipient is a hands-on manager: be specific about the workflow problem and how it would help day to day."],
];

/** Rule-based seniority → style lookup (deterministic, no LLM). */
export function seniorityGuidance(title: string | null): string {
  if (!title) return "";
  for (const [rx, text] of SENIORITY_PATTERNS) if (rx.test(title)) return text;
  return "";
}
