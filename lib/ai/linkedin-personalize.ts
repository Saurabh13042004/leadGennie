import { generateJson, Type } from "@/lib/ai/gemini";

export type PersonalizedMessage = {
  message: string;
  insights: string;
};

export type ExtractedLeadInfo = {
  full_name: string;
  job_title: string | null;
  company: string | null;
};

// Cap what we forward into a prompt — LinkedIn profile pages carry a huge
// amount of nav/sidebar/footer boilerplate ("People you may know", ads,
// "Show all") past the top card + About + first few posts. This keeps token
// cost bounded without losing the part that actually contains signal.
const MAX_PAGE_TEXT_CHARS = 6000;

const MESSAGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
    insights: { type: Type.STRING },
  },
  required: ["message", "insights"],
};

const LEAD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    full_name: { type: Type.STRING },
    job_title: { type: Type.STRING, nullable: true },
    company: { type: Type.STRING, nullable: true },
  },
  required: ["full_name"],
};

/**
 * Runs on the server so the extension never needs its own AI credentials.
 *
 * Deliberately takes the raw visible text of the profile page rather than
 * fields pre-extracted by hand-rolled CSS selectors in content.js. LinkedIn's
 * markup varies enormously per profile (recruiter vs. engineer vs. founder
 * layouts, hashed/rotating class names) and selectors chasing it kept
 * silently matching nothing — e.g. a profile with a rich recent-posts
 * history about a YC application and a product launch producing "no public
 * information available" because .feed-shared-update-v2__description never
 * matched. An LLM reading the actual rendered text is far more robust to
 * that variance than another round of guessed selectors would be.
 */
export async function generatePersonalizedLinkedinMessage(
  profileUrl: string,
  pageText: string,
  sdrContext = "",
  customPrompt = ""
): Promise<PersonalizedMessage> {
  const prompt = `You are an expert sales development representative.
Write a highly personalized, concise LinkedIn connection request note (max 300 characters) for the owner of this LinkedIn profile: ${profileUrl}

Here is your (the SDR's) company context and value proposition. You must naturally weave this value proposition into the connection request to pitch your service smoothly without being overly aggressive:
"${sdrContext || "You are selling a B2B software solution."}"

${customPrompt ? `\nCRITICAL INSTRUCTIONS FOR MESSAGE FORMAT AND TONE:\n${customPrompt}\nYou MUST follow the above instructions exactly.` : ""}

Below is the raw visible text scraped from their profile page — it includes some LinkedIn site chrome (navigation, "People you may know", footer links) that isn't about this person; ignore that and focus on their name, headline, About section, and recent posts/activity.

Ground the message and the insight in something SPECIFIC actually present in this text — a real recent post topic, their stated role, a real project or company they mention. Do not invent generic filler ("streamline operations", "drive growth") if the text doesn't support it. Also provide a brief 1-sentence 'insight' about them — something real and specific from the text. Only say no public information is available if the text truly contains nothing about them at all; do not default to that when there is in fact relevant content below.

Profile page text:
${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}`;

  return generateJson<PersonalizedMessage>(prompt, MESSAGE_SCHEMA);
}

/** Same raw-text-in, AI-structures-it-out approach, for the "Add to Lead List" action. */
export async function extractLeadInfoFromPage(pageText: string): Promise<ExtractedLeadInfo> {
  const prompt = `The following is the raw visible text scraped from a LinkedIn profile page. It includes some site navigation/footer noise — ignore that.

Extract the profile OWNER's (not a commenter's, not a "People also viewed" suggestion):
- full_name: their actual name
- job_title: their current job title/role, if stated in their headline or current position
- company: their current company/employer, if stated

Only use what's explicitly in the text. If no title or company is clearly stated, return null for that field rather than guessing.

Page text:
${pageText.slice(0, MAX_PAGE_TEXT_CHARS)}`;

  const result = await generateJson<{ full_name?: string; job_title?: string | null; company?: string | null }>(
    prompt,
    LEAD_SCHEMA
  );

  return {
    full_name: result.full_name?.trim() || "Unknown",
    job_title: result.job_title?.trim() || null,
    company: result.company?.trim() || null,
  };
}
