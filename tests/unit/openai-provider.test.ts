import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();

vi.mock("openai", () => {
  class APIError extends Error {
    constructor(readonly status: number, readonly code: string | null = null) {
      super(`api error ${status}`);
    }
  }
  class OpenAI {
    static APIError = APIError;
    chat = { completions: { create } };
  }
  return { default: OpenAI };
});

import OpenAI from "openai";
import { createOpenAiProvider, toStrictJsonSchema } from "@/lib/ai/providers/openai";
import { LlmError, Type } from "@/lib/ai/llm-types";
import { mapAiError } from "@/lib/api/ai-errors";
import { AppError } from "@/lib/api/errors";

describe("toStrictJsonSchema", () => {
  it("requires every property, nulls out optional/nullable ones, forbids extras", () => {
    const strict = toStrictJsonSchema({
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        title: { type: Type.STRING, nullable: true },
        note: { type: Type.STRING }, // optional (not in `required`)
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["subject", "tags"],
    });

    expect(strict.additionalProperties).toBe(false);
    expect(strict.required).toEqual(["subject", "title", "note", "tags"]);
    expect(strict.properties?.subject.type).toBe("string");
    expect(strict.properties?.title.type).toEqual(["string", "null"]);
    expect(strict.properties?.note.type).toEqual(["string", "null"]);
    expect(strict.properties?.tags.items?.type).toBe("string");
  });

  it("recurses into nested objects", () => {
    const strict = toStrictJsonSchema({
      type: Type.OBJECT,
      properties: { inner: { type: Type.OBJECT, properties: { a: { type: Type.INTEGER } }, required: ["a"] } },
      required: ["inner"],
    });
    expect(strict.properties?.inner.additionalProperties).toBe(false);
    expect(strict.properties?.inner.required).toEqual(["a"]);
  });
});

describe("OpenAI provider", () => {
  beforeEach(() => {
    create.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
  });

  it("sends a strict json_schema request and parses the result", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: '{"body":"hi"}' } }] });
    const provider = createOpenAiProvider();
    const out = await provider.generateJson<{ body: string }>("write", {
      type: Type.OBJECT,
      properties: { body: { type: Type.STRING } },
      required: ["body"],
    });
    expect(out).toEqual({ body: "hi" });
    const args = create.mock.calls[0][0];
    expect(args.model).toBe("gpt-4o-mini");
    expect(args.response_format.type).toBe("json_schema");
    expect(args.response_format.json_schema.strict).toBe(true);
  });

  it("fails clearly when the key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(createOpenAiProvider().generateText("x")).rejects.toThrow(/OPENAI_API_KEY is not set/);
  });

  it("maps provider failures onto stable error codes", async () => {
    const Api = (OpenAI as unknown as { APIError: new (s: number, c?: string) => Error }).APIError;
    const provider = createOpenAiProvider();

    create.mockRejectedValueOnce(new Api(429, "insufficient_quota"));
    const quota = await provider.generateText("x").catch((e) => mapAiError(e));
    expect(quota).toBeInstanceOf(AppError);
    expect((quota as AppError).code).toBe("QUOTA_EXCEEDED");

    create.mockRejectedValueOnce(new Api(429, "rate_limit_exceeded"));
    const rate = await provider.generateText("x").catch((e) => mapAiError(e));
    expect((rate as AppError).code).toBe("RATE_LIMITED");

    create.mockRejectedValueOnce(new Api(500));
    const generic = await provider.generateText("x").catch((e) => mapAiError(e));
    expect((generic as AppError).code).toBe("PROVIDER_ERROR");
  });

  it("surfaces refusals and empty/invalid output as LlmError", async () => {
    const provider = createOpenAiProvider();
    const schema = { type: Type.OBJECT, properties: { a: { type: Type.STRING } }, required: ["a"] };

    create.mockResolvedValueOnce({ choices: [{ message: { content: null, refusal: "no" } }] });
    await expect(provider.generateJson("x", schema)).rejects.toBeInstanceOf(LlmError);

    create.mockResolvedValueOnce({ choices: [{ message: { content: "not json" } }] });
    await expect(provider.generateJson("x", schema)).rejects.toThrow(/invalid JSON/);
  });
});
