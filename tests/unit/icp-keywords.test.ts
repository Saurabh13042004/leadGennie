import { afterEach, describe, expect, it } from "vitest";
import { FakeLlm } from "@/lib/ai/fake";
import { setLlmProvider } from "@/lib/ai/client";
import { cleanKeywords, proposeIcpKeywords, MAX_SUGGESTED_KEYWORDS } from "@/lib/ai/icp-suggest";
import { icpSchema } from "@/lib/domain/workspace/icp";
import { budgetKeywordWeights, KEYWORD_WEIGHT_BUDGET, toEngineIcp } from "@/lib/intelligence/icp";

afterEach(() => setLlmProvider(null));

describe("keyword weights", () => {
  const kw = (n: number) => Array.from({ length: n }, (_, i) => ({ keyword: `k${i}`, weight: 10 }));
  const total = (l: { weight: number }[]) => l.reduce((a, b) => a + b.weight, 0);

  it("leaves a short list alone and caps a long one at the budget, keeping relative weights", () => {
    expect(budgetKeywordWeights(kw(2))).toEqual(kw(2));
    const capped = budgetKeywordWeights(kw(8));
    expect(total(capped)).toBeLessThanOrEqual(KEYWORD_WEIGHT_BUDGET + 0.05);
    expect(new Set(capped.map((k) => k.weight)).size).toBe(1);
    const uneven = budgetKeywordWeights([{ keyword: "a", weight: 30 }, { keyword: "b", weight: 10 }]);
    expect(uneven[0].weight).toBeCloseTo(uneven[1].weight * 3, 1);
  });

  it("many keywords can no longer drown the title: a target-title match keeps most of its share (was 15/100 with 8 keywords)", () => {
    const icp = icpSchema.parse({
      industries: ["Software"], geographies: ["India"], titles: ["CEO", "CTO"], employee_range: { min: 5, max: 200 },
      scoring: { keywords: ["sdr", "co founder", "ceo", "cto", "software engineer", "hiring", "recent funding", "revenue milestone"].map((keyword) => ({ keyword, weight: 10 })) },
    });
    const e = toEngineIcp(icp);
    const core = 25 + 20 + 15 + 25;
    const keywords = total(e.keyword_signals);
    expect(Math.round((25 / (core + keywords)) * 100)).toBeGreaterThanOrEqual(23);
    expect(keywords).toBeLessThanOrEqual(KEYWORD_WEIGHT_BUDGET + 0.05);
  });
});

describe("cleanKeywords", () => {
  it("drops role words, target titles, duplicates, empties and over-long items; caps the count", () => {
    const out = cleanKeywords(["  Mobile App ", "mobile app", "CTO", "vp of engineering", "hiring engineers", "", "x", "a".repeat(41), "- cloud migration", "ai chatbot"], ["ai chatbot"]);
    expect(out).toEqual(["mobile app", "hiring engineers", "cloud migration"]);
    expect(cleanKeywords(Array.from({ length: 30 }, (_, i) => `signal ${i}`))).toHaveLength(MAX_SUGGESTED_KEYWORDS);
  });
});

describe("proposeIcpKeywords", () => {
  const input = { positioning: "We build custom AI chatbots and cloud tools for startups.", companyName: "DICE Solutions", industries: ["Software"], titles: ["CEO", "CTO"] };

  it("asks about what is sold and returns only cleaned keywords", async () => {
    const llm = new FakeLlm().json({ keywords: ["AI chatbot", "CTO", "cloud migration", "ceo", "startup"] });
    setLlmProvider(llm);
    const usage: unknown[] = [];
    expect(await proposeIcpKeywords(input, { onUsage: (u) => usage.push(u) })).toEqual(["ai chatbot", "cloud migration", "startup"]);
    expect(llm.calls[0].prompt).toContain("custom AI chatbots");
    expect(usage).toHaveLength(1);
  });

  it("rejects an answer that isn't the schema instead of returning something partial", async () => {
    setLlmProvider(new FakeLlm().json({ words: "nope" }));
    await expect(proposeIcpKeywords(input)).rejects.toThrow(/validation/i);
  });
});
