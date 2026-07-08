import { generateJson, Type } from "@/lib/ai/gemini";

export type Channel = "email" | "linkedin_dm";

export type DraftedMessage = {
  subject?: string;
  body: string;
};

const EMAIL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING },
    body: { type: Type.STRING },
  },
  required: ["subject", "body"],
};

const LINKEDIN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    body: { type: Type.STRING },
  },
  required: ["body"],
};

export async function draftMessage(input: {
  channel: Channel;
  stepIndex: number;
  audienceLabel: string;
  audiencePrompt?: string | null;
  campaignName?: string;
  senderCompany?: string | null;
  senderPitch?: string | null;
}): Promise<DraftedMessage> {
  const { channel, stepIndex, audienceLabel, audiencePrompt, campaignName, senderCompany, senderPitch } = input;

  const senderContext = senderPitch?.trim()
    ? `You represent ${senderCompany?.trim() || "the sender's company"}. Here is what they sell and why a prospect should care, in the sender's own words:\n"${senderPitch.trim()}"\nGround every claim in this description. Do not invent product features, outcomes, or stats that aren't implied by it.`
    : `No product description was provided for ${senderCompany?.trim() || "the sender"}. Do NOT invent a product, a value proposition, or fake claims (e.g. "we help you scale" / "improve efficiency") — those read as generic spam. Instead, keep the message a short, genuine-sounding note that references the recipient's role/company and asks an open question to start a conversation, without claiming to sell them anything specific.`;

  const context = `You are writing outbound sales copy for a B2B SDR sequence.

${senderContext}

Target audience: ${audienceLabel}${audiencePrompt ? `\nAudience description: ${audiencePrompt}` : ""}
Campaign: ${campaignName ?? audienceLabel}
This is touchpoint #${stepIndex + 1} in the sequence (0-indexed step ${stepIndex}).

Use the literal placeholders {{first_name}} and {{company}} wherever you'd reference the recipient's first name or company — do not invent a specific name or company, the placeholders will be substituted per-recipient later.

Tone: concise, human, not salesy. No corporate buzzwords ("synergy", "leverage", "streamline", "unlock"). Keep it short — a busy exec should read it in under 15 seconds. Write plain sentences a human would actually send, not a template.

Formatting: separate distinct thoughts with actual newline characters (blank line between short paragraphs), the way a real email is written. Never run sentences together with no spacing.`;

  if (channel === "email") {
    const prompt = `${context}

Write a cold/follow-up outbound email${stepIndex > 0 ? " (this is a follow-up to a previous email in the sequence, so keep it brief and reference that you're following up)" : ""}. Return JSON with "subject" and "body".`;
    const result = await generateJson<DraftedMessage>(prompt, EMAIL_SCHEMA);
    return { subject: result.subject, body: result.body };
  }

  const prompt = `${context}

Write a short LinkedIn connection/DM message (max 300 characters, no subject line). Return JSON with "body".`;
  const result = await generateJson<DraftedMessage>(prompt, LINKEDIN_SCHEMA);
  return { body: result.body };
}
