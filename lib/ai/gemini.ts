import { GoogleGenAI, Type, type Schema } from "@google/genai";

export class GeminiError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "GeminiError";
  }
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
    throw new GeminiError("Gemini request failed", error);
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
    throw new GeminiError("Gemini request failed", error);
  }
}

export { Type };
