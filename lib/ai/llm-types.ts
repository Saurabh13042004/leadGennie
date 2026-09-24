/**
 * Provider-neutral types for structured LLM calls. Callers describe their
 * expected output with `LlmSchema` (a small JSON-Schema subset built from
 * `Type`) and never import a vendor SDK — see lib/ai/client.ts.
 */

/** JSON-Schema type names. Lowercase on purpose: these are used verbatim. */
export const Type = {
  OBJECT: "object",
  STRING: "string",
  NUMBER: "number",
  INTEGER: "integer",
  BOOLEAN: "boolean",
  ARRAY: "array",
} as const;

export type LlmSchema = {
  type: string;
  description?: string;
  enum?: string[];
  /** Field may be `null` (in addition to its type). */
  nullable?: boolean;
  properties?: Record<string, LlmSchema>;
  items?: LlmSchema;
  /** Object properties that must be present and non-null. Others are optional. */
  required?: string[];
};

export class LlmError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LlmError";
  }
}

/** Tokens a single call consumed, reported by the provider (0/0 when it doesn't say). */
export type LlmUsage = { tokensIn: number; tokensOut: number; model: string };

export type LlmCallOptions = {
  /** Called once per provider call with the tokens it used — how callers meter spend (usage_records). */
  onUsage?: (usage: LlmUsage) => void;
};

/** Adapter contract every LLM vendor implements (Liskov: same errors, same shapes). */
export interface LlmProvider {
  readonly model: string;
  generateJson<T>(prompt: string, schema: LlmSchema, opts?: LlmCallOptions): Promise<T>;
  generateText(prompt: string, opts?: LlmCallOptions): Promise<string>;
}
