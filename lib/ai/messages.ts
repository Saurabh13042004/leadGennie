import { generateJson, GeminiError, Type, MODEL_NAME } from "@/lib/ai/gemini";

export type Channel = "email" | "linkedin_dm";

// Deliberately a local duplicate of lib/actions/prompts.ts's SchemaField
// shape rather than an import from it — that file is a "use server" action
// module, and re-exporting/importing its types elsewhere has previously
// broken the Turbopack build in confusing ways. Keep this plain lib file
// decoupled from it.
type PromptSchemaField = { key: string; type: "string" | "number"; required: boolean };

export type DraftedMessage = {
  subject?: string;
  body: string;
  /** CAM-03: the exact prompt/model behind this message, for audit. */
  prompt: string;
  model: string;
};

type RawDraft = { subject?: string; body: string };

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
    const result = await generateJson<RawDraft>(prompt, EMAIL_SCHEMA);
    return { subject: result.subject, body: result.body, prompt, model: MODEL_NAME };
  }

  const prompt = `${context}

Write a short LinkedIn connection/DM message (max 300 characters, no subject line). Return JSON with "body".`;
  const result = await generateJson<RawDraft>(prompt, LINKEDIN_SCHEMA);
  return { body: result.body, prompt, model: MODEL_NAME };
}

function substitutePromptTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

/**
 * Tries a workspace's published Prompt Library version for this channel
 * before the built-in `draftMessage` default. Fails safe: any schema
 * mismatch, a missing "body" field, or a generation error returns `null`
 * rather than throwing — the caller falls back to the default generator.
 */
export async function draftFromPromptVersion(
  version: { template: string; outputSchema: PromptSchemaField[]; model: string },
  substitutions: Record<string, string>
): Promise<DraftedMessage | null> {
  const hasBody = version.outputSchema.some((f) => f.key === "body");
  if (!hasBody) return null;

  const prompt = substitutePromptTemplate(version.template, substitutions);
  const schema = {
    type: Type.OBJECT,
    properties: Object.fromEntries(
      version.outputSchema.map((f) => [f.key, { type: f.type === "number" ? Type.NUMBER : Type.STRING }])
    ),
    required: version.outputSchema.filter((f) => f.required).map((f) => f.key),
  };

  try {
    const result = await generateJson<Record<string, unknown>>(prompt, schema);
    if (typeof result.body !== "string" || !result.body.trim()) return null;
    return {
      body: result.body,
      subject: typeof result.subject === "string" ? result.subject : undefined,
      prompt,
      model: version.model,
    };
  } catch (error) {
    if (error instanceof GeminiError) return null;
    throw error;
  }
}
