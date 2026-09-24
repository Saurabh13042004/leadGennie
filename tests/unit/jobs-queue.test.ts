import { describe, expect, it } from "vitest";
import { backoffSeconds } from "@/lib/jobs/queue";
import { toEngineIcp, icpFingerprint } from "@/lib/intelligence/icp";
import { icpSchema } from "@/lib/domain/workspace/icp";
import { extractOfferKeywords } from "@/lib/intelligence/request";
import { engineKey } from "@/lib/intelligence/jobs";

describe("backoffSeconds", () => {
  it("grows exponentially with jitter and is capped at 15 minutes", () => {
    expect(backoffSeconds(1, () => 0.5)).toBe(5);
    expect(backoffSeconds(2, () => 0.5)).toBe(10);
    expect(backoffSeconds(3, () => 0.5)).toBe(20);
    expect(backoffSeconds(30, () => 0.5)).toBe(900);
    expect(backoffSeconds(3, () => 0)).toBeLessThan(backoffSeconds(3, () => 1));
  });
});

describe("toEngineIcp", () => {
  const icp = icpSchema.parse({
    industries: ["B2B SaaS"], geographies: ["India", "EMEA"], titles: ["CTO", "VP of Engineering"], employee_range: { min: 50, max: null },
    exclusions: { industries: ["Gambling"], domains: ["competitor.com"], titles: ["Intern"] },
    scoring: { min_score_to_qualify: 65, weights: { industry: 30, employee_range: 10, geography: 20, title: 40 }, keywords: [{ keyword: "outbound", weight: 12 }] },
  });
  it("maps the workspace lists + weights onto the engine schema without duplicating taxonomy", () => {
    expect(toEngineIcp(icp)).toEqual({
      industries: [{ value: "B2B SaaS", weight: 30 }],
      employee_range: { min: 50, max: null, weight: 10 },
      geographies: [{ value: "India", weight: 20 }, { value: "EMEA", weight: 20 }],
      titles: [{ keywords: ["CTO", "VP of Engineering"], weight: 40 }],
      keyword_signals: [{ keyword: "outbound", weight: 12 }],
      exclusions: { industries: ["Gambling"], domains: ["competitor.com"], titles: ["Intern"] },
      min_score_to_qualify: 65,
    });
  });
  it("an empty ICP maps to an empty engine ICP (nothing invented)", () => {
    const e = toEngineIcp(icpSchema.parse({}));
    expect(e).toMatchObject({ industries: [], geographies: [], titles: [], employee_range: null, keyword_signals: [], min_score_to_qualify: 70 });
  });
  it("old ICPs saved before `scoring` existed still parse (additive schema)", () => {
    const legacy = icpSchema.parse({ version: 1, industries: ["Fintech"], employee_range: null, geographies: [], titles: [], exclusions: { industries: [], domains: [], titles: [] } });
    expect(legacy.scoring.weights.industry).toBe(25);
  });
  it("the fingerprint changes when — and only when — scoring changes", async () => {
    const a = await icpFingerprint(icp);
    expect(await icpFingerprint(icpSchema.parse(JSON.parse(JSON.stringify(icp))))).toBe(a);
    expect(await icpFingerprint({ ...icp, industries: ["Fintech"] })).not.toBe(a);
    expect(await icpFingerprint({ ...icp, scoring: { ...icp.scoring, min_score_to_qualify: 80 } })).not.toBe(a);
  });
});

describe("engine idempotency keys are opaque", () => {
  it("are stable, unique per (workspace, entity, version) and reveal no ids", () => {
    const k = engineKey("lead", 3, 42, 1);
    expect(k).toBe(engineKey("lead", 3, 42, 1));
    expect(k).toMatch(/^research:[0-9a-f]{24}$/);
    expect(new Set([engineKey("lead", 3, 42, 2), engineKey("lead", 4, 42, 1), engineKey("company", 3, 42, 1)]).size).toBe(3);
    expect(k).not.toContain("42");
  });
});

describe("extractOfferKeywords", () => {
  it("prefers the workspace's own scoring keywords, then frequent words from positioning", () => {
    const icp = icpSchema.parse({ scoring: { keywords: [{ keyword: "SDR", weight: 10 }] } });
    const kws = extractOfferKeywords("We help outbound teams book more outbound meetings without hiring", icp);
    expect(kws[0]).toBe("sdr");
    expect(kws).toContain("outbound");
    expect(kws).not.toContain("the");
  });
});
