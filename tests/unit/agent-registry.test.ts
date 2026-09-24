import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Type } from "@/lib/ai/llm-types";
import { defaultToolRegistry, ToolRegistry, type Tool } from "@/lib/agent/tools";

const stub = (name: string, args: Tool["argsJsonSchema"] = {}): Tool<unknown> => ({
  name, label: name, description: name, inputSchema: z.strictObject({}), argsJsonSchema: args, costly: false, producesLeadIds: false,
  available: () => true, estimate: async () => ({ records: null, note: null }), run: async () => ({ kind: "done", output: {}, summary: "" }),
});

describe("tool registry", () => {
  it("contains exactly the tools that exist today — adding one is a deliberate change to this test", () => {
    expect(defaultToolRegistry.names().sort()).toEqual(["find_leads", "rank_leads", "research_leads"]);
  });

  it("has NO tool that could send email, schedule, create campaigns, or change/delete data", () => {
    const forbidden = /send|e-?mail|mail|campaign|schedule|launch|delete|remove|import|write|update|create|approve/i;
    for (const name of defaultToolRegistry.names()) {
      const tool = defaultToolRegistry.get(name)!;
      expect(name, `tool name "${name}"`).not.toMatch(forbidden);
      // The planner is only ever told these; a description offering a forbidden capability would invite it.
      expect(tool.description.replace(/cannot find new prospects|Cannot find new prospects/g, ""), `description of ${name}`).not.toMatch(/\b(send|schedule|delete|launch)\b/i);
    }
  });

  it("unknown tool names fail closed (undefined, never a fuzzy match)", () => {
    expect(defaultToolRegistry.get("send_email")).toBeUndefined();
    expect(defaultToolRegistry.get("FIND_LEADS")).toBeUndefined();
    expect(defaultToolRegistry.get("find_leads ")).toBeUndefined();
    expect(defaultToolRegistry.get("__proto__")).toBeUndefined();
  });

  it("every tool's input schema is strict: unknown keys (e.g. literal lead ids or a workspace id) are rejected", () => {
    const probes: Record<string, Record<string, unknown>> = {
      find_leads: { limit: 5 },
      research_leads: { from: "s1" },
      rank_leads: { from: "s1", top: 3 },
    };
    for (const [name, valid] of Object.entries(probes)) {
      const tool = defaultToolRegistry.get(name)!;
      expect(tool.inputSchema.safeParse(valid).success, `${name} accepts its valid args`).toBe(true);
      expect(tool.inputSchema.safeParse({ ...valid, workspaceId: 2 }).success, `${name} rejects workspaceId`).toBe(false);
      expect(tool.inputSchema.safeParse({ ...valid, leadIds: [1, 2] }).success, `${name} rejects literal leadIds`).toBe(false);
    }
  });

  it("caps are enforced by the schema itself, not just by clamping", () => {
    const find = defaultToolRegistry.get("find_leads")!;
    expect(find.inputSchema.safeParse({ limit: 51 }).success).toBe(false);
    expect(find.inputSchema.safeParse({ limit: 0 }).success).toBe(false);
    expect(defaultToolRegistry.get("rank_leads")!.inputSchema.safeParse({ from: "s1", top: 11 }).success).toBe(false);
  });

  it("rejects duplicate names and conflicting arg types", () => {
    expect(() => new ToolRegistry([stub("a"), stub("a")])).toThrow(/Duplicate/);
    expect(() => new ToolRegistry([stub("a", { x: { type: Type.STRING } }), stub("b", { x: { type: Type.INTEGER } })])).toThrow(/different types/);
    expect(() => new ToolRegistry([stub("a", { x: { type: Type.STRING } }), stub("b", { x: { type: Type.STRING } })])).not.toThrow();
  });

  it("availability depends on the environment (research needs the engine)", () => {
    const off = { engineAvailable: () => false } as never;
    const on = { engineAvailable: () => true } as never;
    expect(defaultToolRegistry.available(off).map((t) => t.name).sort()).toEqual(["find_leads", "rank_leads"]);
    expect(defaultToolRegistry.available(on).map((t) => t.name)).toContain("research_leads");
    expect(defaultToolRegistry.unavailable(off).map((t) => t.name)).toEqual(["research_leads"]);
    expect(defaultToolRegistry.unavailable(on)).toEqual([]);
  });
});
