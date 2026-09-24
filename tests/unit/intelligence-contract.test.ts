import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { checkInvariants } from "@/lib/intelligence/invariants";
import { researchResultSchema, scoreDataSchema, runViewSchema, capabilitiesSchema, evidenceSchema, signalSchema } from "@/lib/intelligence/schemas";

const ROOT = process.cwd();
const openapi = JSON.parse(readFileSync(join(ROOT, "services/intelligence/openapi.json"), "utf-8")) as { components: { schemas: Record<string, { properties?: Record<string, unknown>; required?: string[] }> } };
const fixtures = readdirSync(join(ROOT, "tests/fixtures/intelligence")).filter((f) => f.endsWith(".json"));
const load = (f: string) => JSON.parse(readFileSync(join(ROOT, "tests/fixtures/intelligence", f), "utf-8"));

/** Top-level keys of a zod object (unwrapping defaults/optionals). */
type Wrapped = { shape?: Record<string, unknown>; _def?: { innerType?: Wrapped }; def?: { innerType?: Wrapped } };
function zodKeys(schema: z.ZodType): string[] {
  let s = schema as unknown as Wrapped | undefined;
  while (s && !s.shape && (s._def?.innerType || s.def?.innerType)) s = s._def?.innerType ?? s.def?.innerType;
  return Object.keys(s?.shape ?? {});
}

describe("zod mirrors ⇄ engine OpenAPI (drift = a failing test, not a production surprise)", () => {
  const pairs: [string, z.ZodType][] = [
    ["ResearchResult", researchResultSchema],
    ["Evidence", evidenceSchema],
    ["Signal", signalSchema],
    ["ScoreData", scoreDataSchema],
    ["RunView", runViewSchema],
    ["Capabilities", capabilitiesSchema],
  ];
  it.each(pairs)("%s: every property the engine declares is mirrored", (name, schema) => {
    const declared = Object.keys(openapi.components.schemas[name].properties ?? {});
    const mirrored = zodKeys(schema);
    expect(declared.filter((k) => !mirrored.includes(k)), `engine fields missing from the zod mirror of ${name}`).toEqual([]);
  });
  it.each(pairs)("%s: every property we REQUIRE exists in the engine contract", (name, schema) => {
    const declared = new Set(Object.keys(openapi.components.schemas[name].properties ?? {}));
    expect(zodKeys(schema).filter((k) => !declared.has(k)), `zod fields for ${name} the engine does not send`).toEqual([]);
  });
});

describe("engine golden fixtures", () => {
  it("there are fixtures to test against", () => expect(fixtures.length).toBeGreaterThanOrEqual(4));
  it.each(fixtures)("%s parses with zod and satisfies every contract invariant", (f) => {
    const parsed = researchResultSchema.parse(load(f));
    expect(checkInvariants(parsed)).toEqual([]);
  });
});

describe("checkInvariants catches every way an engine result could lie", () => {
  const good = () => researchResultSchema.parse(load("acme.example.json"));
  const mutate = (fn: (r: ReturnType<typeof good>) => void) => { const r = good(); fn(r); return checkInvariants(r); };

  it("dangling evidence id on a signal", () => expect(mutate((r) => (r.signals[0].evidence_ids = ["ev_999"]))[0]).toMatch(/does not resolve/));
  it("signal without evidence", () => expect(mutate((r) => (r.signals[0].evidence_ids = []))).toContainEqual(expect.stringMatching(/without evidence/)));
  it("field without evidence", () => expect(mutate((r) => (r.company.fields[0].evidence_ids = []))).toContainEqual(expect.stringMatching(/field without evidence/)));
  it("verified signal on unverified evidence", () => expect(mutate((r) => (r.evidence[0].verification.verified = false))).toContainEqual(expect.stringMatching(/verified signal references unverified/)));
  it("outreach on unverified evidence", () => expect(mutate((r) => { r.evidence[3].verification.verified = false; r.outreach.evidence_ids = ["ev_4"]; })).toContainEqual(expect.stringMatching(/outreach: references unverified/)));
  it("score points from unverified evidence", () => expect(mutate((r) => { r.icp.breakdown[0].points = 5; r.icp.breakdown[0].evidence_ids = ["ev_4"]; r.evidence[3].verification.verified = false; })).toContainEqual(expect.stringMatching(/points awarded from unverified evidence/)));
  it("intent points from an unverified signal", () => expect(mutate((r) => { r.signals[0].verified = false; r.intent.breakdown[0] = { ...r.intent.breakdown[0], signal_id: "sg_1", points: 9 }; })).toContainEqual(expect.stringMatching(/unverified signal/)));
  it("duplicate ids", () => expect(mutate((r) => (r.evidence[1].id = r.evidence[0].id))).toContainEqual("duplicate evidence ids"));
});

describe("schema hardening", () => {
  const base = () => load("acme.example.json");
  it("rejects non-http(s) source URLs (evidence is rendered as a link)", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,<script>", "ftp://x/y", "//evil.example"]) {
      const r = base(); r.evidence[0].source_url = bad;
      expect(researchResultSchema.safeParse(r).success, bad).toBe(false);
    }
  });
  it("rejects an unknown contract version and out-of-range scores", () => {
    expect(researchResultSchema.safeParse({ ...base(), schema_version: "2" }).success).toBe(false);
    const r = base(); r.icp.score = 101;
    expect(researchResultSchema.safeParse(r).success).toBe(false);
  });
  it("tolerates ADDITIVE engine fields (unknown keys are stripped, not fatal)", () => {
    const r = base(); r.brand_new_field = { x: 1 }; r.evidence[0].extra = true;
    const parsed = researchResultSchema.parse(r);
    expect((parsed as Record<string, unknown>).brand_new_field).toBeUndefined();
  });
  it("caps the evidence count (a runaway engine can't flood the database)", () => {
    const r = base(); r.evidence = Array.from({ length: 301 }, (_, i) => ({ ...r.evidence[0], id: `ev_${i}` }));
    expect(researchResultSchema.safeParse(r).success).toBe(false);
  });
});
