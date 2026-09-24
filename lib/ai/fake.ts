import { LlmError, type LlmCallOptions, type LlmProvider, type LlmSchema } from "@/lib/ai/llm-types";

type JsonHandler = (prompt: string, schema: LlmSchema) => unknown;
type TextHandler = (prompt: string) => string;

/**
 * Scripted LLM for tests — implements the same `LlmProvider` contract, so callers can't tell the difference.
 *
 *   const llm = new FakeLlm().json(() => ({ subject: "Hi", body: "…" }));
 *   setLlmProvider(llm);
 *
 * A handler may return anything (including invalid shapes, to test validation) or throw an `LlmError`.
 * Each call reports fixed token usage so metering paths are exercised.
 */
export class FakeLlm implements LlmProvider {
  readonly model = "fake-llm";
  readonly calls: { kind: "json" | "text"; prompt: string }[] = [];
  private jsonHandlers: JsonHandler[] = [];
  private textHandler: TextHandler | null = null;

  /** Queue a JSON response (used in order; the last one repeats). */
  json(handler: JsonHandler | unknown): this {
    this.jsonHandlers.push(typeof handler === "function" ? (handler as JsonHandler) : () => handler);
    return this;
  }

  text(handler: TextHandler | string): this {
    this.textHandler = typeof handler === "function" ? handler : () => handler;
    return this;
  }

  async generateJson<T>(prompt: string, schema: LlmSchema, opts?: LlmCallOptions): Promise<T> {
    this.calls.push({ kind: "json", prompt });
    opts?.onUsage?.({ tokensIn: 100, tokensOut: 50, model: this.model });
    const handler = this.jsonHandlers[Math.min(this.calls.filter((c) => c.kind === "json").length - 1, this.jsonHandlers.length - 1)];
    if (!handler) throw new LlmError("FakeLlm has no JSON handler");
    return handler(prompt, schema) as T;
  }

  async generateText(prompt: string, opts?: LlmCallOptions): Promise<string> {
    this.calls.push({ kind: "text", prompt });
    opts?.onUsage?.({ tokensIn: 40, tokensOut: 10, model: this.model });
    if (!this.textHandler) throw new LlmError("FakeLlm has no text handler");
    return this.textHandler(prompt);
  }
}
