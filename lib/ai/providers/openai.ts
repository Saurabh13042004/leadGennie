import OpenAI from "openai";
import { LlmError, type LlmCallOptions, type LlmProvider, type LlmSchema } from "@/lib/ai/llm-types";

export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function openAiModelName(): string {
  return process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
}

type StrictSchema = {
  type: string | string[];
  description?: string;
  enum?: string[];
  properties?: Record<string, StrictSchema>;
  items?: StrictSchema;
  required?: string[];
  additionalProperties?: false;
};

/**
 * Converts our `LlmSchema` into what OpenAI Structured Outputs (`strict: true`)
 * accepts: every object sets `additionalProperties: false` and lists *all* of
 * its properties as required, so an optional or nullable field becomes
 * `["<type>", "null"]` — the model returns `null` instead of omitting it.
 * Callers therefore treat `null` and "absent" the same way.
 */
export function toStrictJsonSchema(schema: LlmSchema, forceNullable = false): StrictSchema {
  const nullable = forceNullable || schema.nullable === true;
  const type = nullable ? [schema.type, "null"] : schema.type;
  const out: StrictSchema = { type };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = nullable ? [...schema.enum] : schema.enum;

  if (schema.type === "object") {
    const properties = schema.properties ?? {};
    const required = new Set(schema.required ?? []);
    out.properties = Object.fromEntries(
      Object.entries(properties).map(([key, child]) => [key, toStrictJsonSchema(child, !required.has(key))])
    );
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  if (schema.type === "array" && schema.items) {
    out.items = toStrictJsonSchema(schema.items);
  }
  return out;
}

/**
 * "Out of money / wait a bit / misconfigured" are different problems that all
 * look like a generic failure otherwise. The wording here is matched by
 * lib/api/ai-errors.ts to pick a stable error code — keep them in sync.
 */
function describeOpenAiError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    if (error.status === 429 && error.code === "insufficient_quota") {
      return "OpenAI API quota exceeded — check your OpenAI billing and usage limits.";
    }
    if (error.status === 429) {
      return "OpenAI rate limit reached — retry in a few seconds.";
    }
    if (error.status === 401) {
      return "OpenAI API key is invalid or revoked (OPENAI_API_KEY).";
    }
  }
  return "OpenAI request failed";
}

export function createOpenAiProvider(): LlmProvider {
  let client: OpenAI | null = null;
  const model = openAiModelName();

  function getClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new LlmError("OPENAI_API_KEY is not set");
    if (!client) client = new OpenAI({ apiKey });
    return client;
  }

  async function complete(prompt: string, schema?: LlmSchema, opts?: LlmCallOptions): Promise<string> {
    try {
      const response = await getClient().chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        ...(schema && {
          response_format: {
            type: "json_schema" as const,
            json_schema: { name: "response", strict: true, schema: toStrictJsonSchema(schema) },
          },
        }),
      });
      opts?.onUsage?.({
        tokensIn: response.usage?.prompt_tokens ?? 0,
        tokensOut: response.usage?.completion_tokens ?? 0,
        model,
      });
      const message = response.choices[0]?.message;
      if (message?.refusal) throw new LlmError(`OpenAI declined the request: ${message.refusal}`);
      const text = message?.content;
      if (!text) throw new LlmError("OpenAI returned an empty response");
      return text;
    } catch (error) {
      if (error instanceof LlmError) throw error;
      throw new LlmError(describeOpenAiError(error), error);
    }
  }

  return {
    model,
    async generateJson<T>(prompt: string, schema: LlmSchema, opts?: LlmCallOptions): Promise<T> {
      const text = await complete(prompt, schema, opts);
      try {
        return JSON.parse(text) as T;
      } catch (error) {
        throw new LlmError("OpenAI returned invalid JSON", error);
      }
    },
    async generateText(prompt: string, opts?: LlmCallOptions): Promise<string> {
      return (await complete(prompt, undefined, opts)).trim();
    },
  };
}
