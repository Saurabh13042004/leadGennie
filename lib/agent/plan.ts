import type { Plan, PlanDraft, PlanStep } from "./types";
import { MAX_PLAN_STEPS } from "./types";
import type { AgentServices, ToolRegistry } from "./tools";

export type PlanValidation = { ok: true; steps: Omit<PlanStep, "estimatedRecords" | "estimateNote">[]; warnings: string[] } | { ok: false; problems: string[] };

/** Drop the `null`s a strict-schema model returns for "not set", so absent and null mean the same thing. */
function withoutNulls(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([, v]) => v !== null && v !== undefined));
}

/**
 * The gate between "the model said so" and "we will do it". Every rule here is deterministic code:
 *  - the tool must exist AND be available right now (unknown names fail closed)
 *  - args must parse against the tool's own strict zod schema (no extra keys, no literal lead ids)
 *  - `from` must point at another step that actually produces leads, and becomes a dependency
 *  - step ids unique, dependencies exist, no self-reference, no cycles, plan size bounded
 * The list ORDER the model wrote is not trusted or required: steps are put into execution order here (a stable
 * topological sort), so a valid plan written "backwards" still runs correctly. Caps are clamped (with a warning)
 * rather than rejected, so a request for "500 leads" becomes a plan for 50.
 */
export function validatePlan(draft: PlanDraft, registry: ToolRegistry, services: AgentServices): PlanValidation {
  const problems: string[] = [];
  const warnings: string[] = [];
  type Parsed = { step: Omit<PlanStep, "estimatedRecords" | "estimateNote">; producesLeadIds: boolean; deps: Set<string>; from: string | null };
  const parsedById = new Map<string, Parsed>();

  if (draft.steps.length > MAX_PLAN_STEPS) problems.push(`A plan may have at most ${MAX_PLAN_STEPS} steps.`);

  // Phase 1 — each step on its own: tool, availability, args.
  for (const step of draft.steps) {
    if (parsedById.has(step.id)) {
      problems.push(`Step id ${step.id} is used more than once.`);
      continue;
    }
    const tool = registry.get(step.tool);
    if (!tool) {
      problems.push(`Step ${step.id}: "${step.tool}" is not a tool you may use. Available tools: ${registry.available(services).map((t) => t.name).join(", ")}.`);
      continue;
    }
    if (!tool.available(services)) {
      problems.push(`Step ${step.id}: the tool "${step.tool}" is not available right now.`);
      continue;
    }

    let args = withoutNulls(step.args);
    if (tool.normalizeArgs) {
      const normalized = tool.normalizeArgs(args);
      args = normalized.args;
      warnings.push(...normalized.warnings);
    }
    const parsed = tool.inputSchema.safeParse(args);
    if (!parsed.success) {
      problems.push(`Step ${step.id} (${step.tool}): invalid arguments — ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ")}.`);
      continue;
    }

    const from = (parsed.data as { from?: unknown }).from;
    const fromId = typeof from === "string" ? from : null;
    const deps = new Set(step.dependsOn);
    if (fromId) deps.add(fromId);
    parsedById.set(step.id, {
      step: { id: step.id, tool: step.tool, args: parsed.data as Record<string, unknown>, dependsOn: [...deps], rationale: step.rationale, costly: tool.costly },
      producesLeadIds: tool.producesLeadIds, deps, from: fromId,
    });
  }

  // Phase 2 — the dependency graph.
  for (const [id, p] of parsedById) {
    for (const dep of p.deps) {
      if (dep === id) problems.push(`Step ${id} depends on itself.`);
      else if (!parsedById.has(dep)) problems.push(`Step ${id} depends on ${dep}, which is not a step in this plan.`);
    }
    if (p.from && parsedById.has(p.from) && !parsedById.get(p.from)!.producesLeadIds) {
      problems.push(`Step ${id} uses ${p.from} as its lead list, but ${p.from} does not produce leads.`);
    }
  }

  // Phase 3 — execution order: stable topological sort (a step only after everything it depends on).
  const ordered: Parsed["step"][] = [];
  const placed = new Set<string>();
  const remaining = [...parsedById.values()];
  while (remaining.length > 0) {
    const nextIdx = remaining.findIndex((p) => [...p.deps].every((d) => placed.has(d) || !parsedById.has(d)));
    if (nextIdx === -1) {
      problems.push(`The steps ${remaining.map((p) => p.step.id).join(", ")} depend on each other in a cycle.`);
      break;
    }
    const [next] = remaining.splice(nextIdx, 1);
    placed.add(next.step.id);
    ordered.push(next.step);
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, steps: ordered, warnings };
}

/** Estimates come from the database (via the tools), never from the model. */
export async function estimateSteps(
  steps: Omit<PlanStep, "estimatedRecords" | "estimateNote">[],
  registry: ToolRegistry,
  ctx: { workspaceId: number; services: AgentServices },
): Promise<PlanStep[]> {
  const records: Record<string, number | null> = {};
  const out: PlanStep[] = [];
  for (const step of steps) {
    const tool = registry.get(step.tool);
    const est = tool ? await tool.estimate(ctx, tool.inputSchema.parse(step.args), records) : { records: null, note: null };
    records[step.id] = est.records;
    out.push({ ...step, estimatedRecords: est.records, estimateNote: est.note });
  }
  return out;
}

/** True when the plan can be approved and run: it has steps and nothing is waiting on the user. */
export function isApprovable(plan: Plan): boolean {
  return plan.steps.length > 0 && plan.missingInputs.length === 0;
}
