import { z } from "zod";

/**
 * Gennie's plan and run-state shapes. Pure types + zod — nothing in lib/agent imports the database, the
 * research service or the job queue (enforced by eslint + tests/unit/agent-boundaries.test.ts): the agent
 * proposes and drives; application code disposes.
 */

/** Per-run cap on leads a single plan may touch (matches the research batch cap). */
export const MAX_LEADS_PER_RUN = 50;
export const MAX_PLAN_STEPS = 6;
export const PROMPT_MIN_LENGTH = 3;
export const PROMPT_MAX_LENGTH = 500;
/** A research step fails (and the run with it) when more than this share of its leads fail. */
export const MAX_STEP_FAILURE_RATIO = 0.3;
/** Wall-clock budget from approval to completion. */
export const RUN_TIMEOUT_MS = 30 * 60 * 1000;

export const stepIdSchema = z.string().regex(/^s[1-9]$/, "Step ids look like s1, s2, …");

export const planStepSchema = z.object({
  id: stepIdSchema,
  tool: z.string().min(1).max(50),
  args: z.record(z.string(), z.unknown()),
  dependsOn: z.array(stepIdSchema).max(3),
  rationale: z.string().max(300),
});

/** What the model returns. Everything the model says is treated as untrusted until `validatePlan` passes. */
export const planDraftSchema = z.object({
  goal: z.string().min(1).max(300),
  steps: z.array(planStepSchema).max(MAX_PLAN_STEPS),
  assumptions: z.array(z.string().max(300)).max(6),
  unsupported: z.array(z.string().max(300)).max(6),
  missingInputs: z.array(z.object({ key: z.string().max(40), question: z.string().max(200) })).max(3),
});
export type PlanDraft = z.infer<typeof planDraftSchema>;

/** The validated plan that is stored on the run and shown to the user. Estimates come from the database, not the model. */
export const planSchema = z.object({
  goal: z.string(),
  steps: z.array(
    planStepSchema.extend({
      estimatedRecords: z.number().int().nonnegative().nullable(),
      estimateNote: z.string().nullable(),
      /** True when the step spends AI / research-engine budget — the UI badges it. */
      costly: z.boolean(),
    }),
  ),
  assumptions: z.array(z.string()),
  unsupported: z.array(z.string()),
  missingInputs: z.array(z.object({ key: z.string(), question: z.string() })),
  warnings: z.array(z.string()),
});
export type Plan = z.infer<typeof planSchema>;
export type PlanStep = Plan["steps"][number];

export type StepStatus = "pending" | "running" | "succeeded" | "failed" | "skipped" | "canceled";

export const stepStateSchema = z.object({
  id: stepIdSchema,
  tool: z.string(),
  status: z.enum(["pending", "running", "succeeded", "failed", "skipped", "canceled"]),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  summary: z.string().nullable(),
  error: z.string().nullable(),
  /** Tool-owned scratch across polls (e.g. the research batch id while waiting). */
  state: z.record(z.string(), z.unknown()),
  output: z.record(z.string(), z.unknown()).nullable(),
});
export type StepState = z.infer<typeof stepStateSchema>;

export const runStateSchema = z.object({
  steps: z.array(stepStateSchema),
  approvedAt: z.string().nullable(),
});
export type RunState = z.infer<typeof runStateSchema>;

export function initialRunState(plan: Plan, approvedAt: Date | null): RunState {
  return {
    approvedAt: approvedAt ? approvedAt.toISOString() : null,
    steps: plan.steps.map((s) => ({
      id: s.id, tool: s.tool, status: "pending", startedAt: null, finishedAt: null, summary: null, error: null, state: {}, output: null,
    })),
  };
}
