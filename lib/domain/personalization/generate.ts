import { generateObject } from "@/lib/ai/client";
import { LlmError, type LlmUsage } from "@/lib/ai/llm-types";
import { buildPrompt, buildRepairPrompt, type LibraryRules } from "./prompt";
import { generationJsonSchema, generationOutputSchema, type GenerationOutput, type PersonalizationContext, type ValidationIssue } from "./types";
import { hasErrors, validateGeneration } from "./validators";

export type GenerationResult = {
  output: GenerationOutput;
  issues: ValidationIssue[];
  /** 1 = the first draft passed; 2 = it needed the one allowed regeneration. */
  attempts: 1 | 2;
  /** The exact prompt behind `output` (audit: message_generations.prompt). */
  prompt: string;
  /** True when no validator raised an error. A failed result is still returned so a person can see why. */
  passed: boolean;
  usage: LlmUsage[];
};

/**
 * Generate → validate → (once) regenerate with the checker's complaints → validate. DB-free on purpose, so the
 * eval harness and the unit tests run exactly the code path production uses.
 *
 * Never falls back to an unvalidated draft: if the second attempt still breaks a rule the result says so
 * (`passed: false`) and the caller stores it as `failed_validation`.
 */
export async function generateFromContext(ctx: PersonalizationContext, library: LibraryRules = {}): Promise<GenerationResult> {
  const usage: LlmUsage[] = [];
  const onUsage = (u: LlmUsage) => usage.push(u);

  const prompt1 = buildPrompt(ctx, library);
  const first = await generateObject<GenerationOutput>(prompt1, generationJsonSchema, generationOutputSchema, { onUsage });
  const issues1 = validateGeneration(first, ctx);
  if (!hasErrors(issues1)) return { output: first, issues: issues1, attempts: 1, prompt: prompt1, passed: true, usage };

  const prompt2 = buildRepairPrompt(prompt1, first, issues1);
  try {
    const second = await generateObject<GenerationOutput>(prompt2, generationJsonSchema, generationOutputSchema, { onUsage });
    const issues2 = validateGeneration(second, ctx);
    return { output: second, issues: issues2, attempts: 2, prompt: prompt2, passed: !hasErrors(issues2), usage };
  } catch (err) {
    // A second answer that is not even valid JSON must not lose the first draft's diagnosis.
    if (err instanceof LlmError && /failed validation/i.test(err.message)) {
      return { output: first, issues: issues1, attempts: 2, prompt: prompt2, passed: false, usage };
    }
    throw err;
  }
}
