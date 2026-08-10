import { GoogleGenAI, ApiError, Type, type Schema } from "@google/genai";

export class GeminiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Distinguishes "temporarily rate/quota-limited, will work again shortly or
 * once billing is upgraded" from every other failure — the two look
 * identical as a generic "Gemini request failed" otherwise, which isn't
 * actionable for whoever sees it (a 20-requests/day free-tier cap is very
 * easy to hit while testing, and the fix is either "wait" or "upgrade
 * billing," not "something is broken").
 */
function describeGeminiError(error: unknown): string {
  if (error instanceof ApiError && error.status === 429) {
    return "Gemini API quota exceeded — the free tier caps you at 20 requests/day for this model. Wait for the quota to reset or upgrade your Gemini API billing plan.";
  }
  return "Gemini request failed";
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new GeminiError("GEMINI_API_KEY is not set");
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const MODEL_NAME = MODEL;

export async function generateJson<T>(prompt: string, schema: Schema): Promise<T> {
  try {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    });
    const text = response.text;
    if (!text) throw new GeminiError("Gemini returned an empty response");
    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw new GeminiError(describeGeminiError(error), error);
  }
}

export async function generateText(prompt: string): Promise<string> {
  try {
    const response = await getClient().models.generateContent({
      model: MODEL,
      contents: prompt,
    });
    const text = response.text;
    if (!text) throw new GeminiError("Gemini returned an empty response");
    return text.trim();
  } catch (error) {
    if (error instanceof GeminiError) throw error;
    throw new GeminiError(describeGeminiError(error), error);
  }
}

export { Type };
