import type { LlmSchema } from "@/lib/ai/llm-types";
import type { AgentServices, Tool } from "./types";

/**
 * Name → tool lookup (open/closed). An unknown name is never "best-effort matched": callers get `undefined`
 * and must fail closed.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, Tool<unknown>>();

  constructor(tools: Tool<unknown>[]) {
    const argOwners = new Map<string, LlmSchema>();
    for (const tool of tools) {
      if (this.byName.has(tool.name)) throw new Error(`Duplicate tool name: ${tool.name}`);
      this.byName.set(tool.name, tool);
      // The planner sees ONE merged args object, so a shared property name must mean the same thing everywhere.
      for (const [prop, schema] of Object.entries(tool.argsJsonSchema)) {
        const seen = argOwners.get(prop);
        if (seen && seen.type !== schema.type) throw new Error(`Tool arg "${prop}" is declared with different types`);
        argOwners.set(prop, schema);
      }
    }
  }

  get(name: string): Tool<unknown> | undefined {
    return this.byName.get(name);
  }

  /** Tools that exist but can't be used right now (e.g. research without the engine). */
  unavailable(services: AgentServices): Tool<unknown>[] {
    return [...this.byName.values()].filter((t) => !t.available(services));
  }

  /** Labels for every registered tool, by name — for views that show a plan. */
  labels(): Record<string, string> {
    return Object.fromEntries([...this.byName.values()].map((t) => [t.name, t.label]));
  }

  names(): string[] {
    return [...this.byName.keys()];
  }

  /** Tools usable right now (e.g. research needs the engine configured). */
  available(services: AgentServices): Tool<unknown>[] {
    return [...this.byName.values()].filter((t) => t.available(services));
  }
}
