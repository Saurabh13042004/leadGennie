import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { generateObject, generateJson, setLlmProvider } from "@/lib/ai/client";
import { FakeLlm } from "@/lib/ai/fake";
import { LlmError, Type } from "@/lib/ai/llm-types";

const schema = { type: Type.OBJECT, properties: { n: { type: Type.NUMBER } }, required: ["n"] };
const parser = z.object({ n: z.number() });

afterEach(() => setLlmProvider(null));

describe("lib/ai/client generateObject", () => {
  it("returns validated output", async () => {
    setLlmProvider(new FakeLlm().json({ n: 3 }));
    expect(await generateObject("p", schema, parser)).toEqual({ n: 3 });
  });

  it("retries ONCE with the validation error appended, then succeeds", async () => {
    const llm = new FakeLlm().json({ n: "three" }).json({ n: 3 });
    setLlmProvider(llm);
    expect(await generateObject("p", schema, parser)).toEqual({ n: 3 });
    expect(llm.calls).toHaveLength(2);
    expect(llm.calls[1].prompt).toContain("previous answer failed validation");
  });

  it("fails visibly after a second invalid answer and never returns partial data", async () => {
    setLlmProvider(new FakeLlm().json({ n: "x" }));
    await expect(generateObject("p", schema, parser)).rejects.toBeInstanceOf(LlmError);
  });

  it("reports token usage to the caller for metering", async () => {
    setLlmProvider(new FakeLlm().json({ n: 1 }));
    const usage: unknown[] = [];
    await generateJson("p", schema, { onUsage: (u) => usage.push(u) });
    expect(usage).toEqual([{ tokensIn: 100, tokensOut: 50, model: "fake-llm" }]);
  });
});
