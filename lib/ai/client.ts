import { createOpenAiProvider, openAiModelName } from "@/lib/ai/providers/openai";
import type { LlmProvider, LlmSchema } from "@/lib/ai/llm-types";

export { Type, LlmError } from "@/lib/ai/llm-types";
export type { LlmSchema, LlmProvider } from "@/lib/ai/llm-types";

/**
 * The single entry point for LLM calls in the Next.js app. Callers depend on
 * this module, not on a vendor SDK, so swapping or faking the provider
 * touches one place (docs/05-decisions.md D-02).
 */

/** Model recorded in audit tables (message_generations, prompt tests). */
export const MODEL_NAME = openAiModelName();

let provider: LlmProvider | null = null;

function getProvider(): LlmProvider {
  if (!provider) provider = createOpenAiProvider();
  return provider;
}

export function generateJson<T>(prompt: string, schema: LlmSchema): Promise<T> {
  return getProvider().generateJson<T>(prompt, schema);
}

export function generateText(prompt: string): Promise<string> {
  return getProvider().generateText(prompt);
}
