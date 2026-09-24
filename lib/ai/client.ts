import type { ZodType } from "zod";
import { createOpenAiProvider, openAiModelName } from "@/lib/ai/providers/openai";
import { LlmError, type LlmCallOptions, type LlmProvider, type LlmSchema } from "@/lib/ai/llm-types";

export { Type, LlmError } from "@/lib/ai/llm-types";
export type { LlmSchema, LlmProvider, LlmUsage, LlmCallOptions } from "@/lib/ai/llm-types";

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

/** Test seam (dependency inversion): swap in `FakeLlm` (lib/ai/fake.ts); pass null to restore the real provider. */
export function setLlmProvider(next: LlmProvider | null): void {
  provider = next;
}

export function generateJson<T>(prompt: string, schema: LlmSchema, opts?: LlmCallOptions): Promise<T> {
  return getProvider().generateJson<T>(prompt, schema, opts);
}

export function generateText(prompt: string, opts?: LlmCallOptions): Promise<string> {
  return getProvider().generateText(prompt, opts);
}

/**
 * Structured output that is VALIDATED before anyone uses it (rule 8): the provider's own schema mode is only a
 * hint, `parser` (zod) is the gate. On a validation failure the model is asked once more with the error appended;
 * a second failure throws `LlmError` — nothing partial is ever returned.
 */
export async function generateObject<T>(
  prompt: string,
  schema: LlmSchema,
  parser: ZodType<T>,
  opts?: LlmCallOptions,
): Promise<T> {
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const p = attempt === 1 ? prompt : `${prompt}\n\nYour previous answer failed validation: ${lastError}\nReturn ONLY valid JSON matching the schema.`;
    const raw = await generateJson<unknown>(p, schema, opts);
    const parsed = parser.safeParse(raw);
    if (parsed.success) return parsed.data;
    lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  throw new LlmError(`Model output failed validation: ${lastError}`);
}
