import { describe, it, expect, vi } from "vitest";

/**
 * Real-network smoke test for the OpenAI adapter. Skipped unless explicitly
 * enabled — never runs in CI:
 *
 *   RUN_LIVE_LLM=1 node --env-file=.env.local node_modules/.bin/vitest run tests/live
 */
vi.unmock("openai");

describe.skipIf(!process.env.RUN_LIVE_LLM)("OpenAI live smoke", () => {
  it("returns schema-valid JSON with nullable and optional fields", async () => {
    const { createOpenAiProvider } = await import("@/lib/ai/providers/openai");
    const { Type } = await import("@/lib/ai/llm-types");
    const out = await createOpenAiProvider().generateJson<{
      subject: string;
      body: string;
      job_title: string | null;
      note?: string | null;
    }>("Write a one-line cold email to a VP Sales named Sam about faster pipeline. No job title is known.", {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        body: { type: Type.STRING },
        job_title: { type: Type.STRING, nullable: true },
        note: { type: Type.STRING },
      },
      required: ["subject", "body"],
    });
    expect(typeof out.subject).toBe("string");
    expect(typeof out.body).toBe("string");
    expect(out.job_title === null || typeof out.job_title === "string").toBe(true);
  });

  it("AI filter builder extracts criteria (arrays + nullable ints)", async () => {
    const { extractCriteriaWithAi } = await import("@/lib/ai/filter");
    const c = await extractCriteriaWithAi("CTOs at Series A fintech companies in India with 50 to 200 employees");
    expect(c.regions.join(" ").toLowerCase()).toContain("india");
    expect(c.titles).toContain("cto");
    expect(c.minEmployees).toBe(50);
    expect(c.maxEmployees).toBe(200);
    expect(c.minRevenueM).toBeNull();
  });

  it("email drafting returns subject + body", async () => {
    const { draftMessage } = await import("@/lib/ai/messages");
    const d = await draftMessage({ channel: "email", stepIndex: 0, audienceLabel: "VP Sales at B2B SaaS", senderCompany: "Acme", senderPitch: "We help SDR teams book more qualified meetings." });
    expect(d.subject && d.subject.length).toBeGreaterThan(0);
    expect(d.body.length).toBeGreaterThan(20);
    expect(d.model).toBe("gpt-4o-mini");
  });

  it("returns plain text", async () => {
    const { createOpenAiProvider } = await import("@/lib/ai/providers/openai");
    const text = await createOpenAiProvider().generateText("Reply with the single word: ok");
    expect(text.toLowerCase()).toContain("ok");
  });
});
