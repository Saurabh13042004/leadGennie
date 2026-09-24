import type { ZodType } from "zod";
import type { LlmSchema } from "@/lib/ai/llm-types";
import type { Logger } from "@/lib/log";

/** A filter over the user's EXISTING leads — Gennie never invents prospects. */
export type LeadFilter = {
  search?: string;
  stage?: string;
  /** none = never researched, researched = has a completed research, failed = last research failed. */
  research?: "none" | "researched" | "failed";
  minScore?: number;
};

export type RankedLead = {
  leadId: number;
  name: string;
  company: string | null;
  title: string | null;
  icpScore: number | null;
  intentScore: number | null;
  qualified: boolean | null;
  researchStatus: string;
  signalTypes: string[];
};

export type ResearchBatchProgress = {
  total: number;
  succeeded: number;
  failed: number;
  canceled: number;
  finished: boolean;
  errors: { leadId: number; message: string }[];
};

export type ResearchStart = {
  batchRunId: number | null;
  enqueued: number;
  skipped: { leadId: number; reason: string }[];
};

/**
 * Everything the agent may touch, as a narrow set of ports (dependency inversion). The real implementation
 * (lib/domain/gennie/services.ts) is workspace-scoped and lives outside lib/agent; tests inject fakes.
 * Note what is NOT here: no way to send email, create campaigns, or write leads.
 */
export interface AgentServices {
  engineAvailable(): boolean;
  countLeads(workspaceId: number, filter: LeadFilter): Promise<number>;
  findLeadIds(workspaceId: number, filter: LeadFilter, limit: number): Promise<{ leadIds: number[]; total: number }>;
  /** Idempotent: re-running for the same run + leads never queues research twice. */
  startResearch(actor: { workspaceId: number; userId: number }, leadIds: number[], parentRunId: number): Promise<ResearchStart>;
  /** The research batch already started for this run (crash recovery), if any. */
  existingResearchBatch(workspaceId: number, parentRunId: number): Promise<number | null>;
  researchProgress(workspaceId: number, batchRunId: number): Promise<ResearchBatchProgress>;
  rankLeads(workspaceId: number, leadIds: number[], top: number): Promise<RankedLead[]>;
}

export type ToolCtx = {
  /** Fixed by the server from the session — never taken from model output. */
  workspaceId: number;
  userId: number;
  runId: number;
  services: AgentServices;
  log: Logger;
};

export type ToolRunInput = {
  /** This step's own scratch from the previous poll. */
  state: Record<string, unknown>;
  /** Outputs of the steps this one depends on, by step id. */
  deps: Record<string, Record<string, unknown>>;
};

export type ToolOutcome =
  | { kind: "done"; output: Record<string, unknown>; summary: string }
  | { kind: "wait"; afterSeconds: number; state: Record<string, unknown>; summary?: string }
  | { kind: "failed"; error: string; output?: Record<string, unknown> };

/**
 * One capability Gennie can use. Adding a capability = adding a Tool to the registry (open/closed); the planner,
 * validator and orchestrator never change. Unknown tool names fail closed.
 */
export interface Tool<I = unknown> {
  readonly name: string;
  /** Short human name shown in the plan and progress views. */
  readonly label: string;
  /** What the planner is told. Must be honest about limits. */
  readonly description: string;
  readonly inputSchema: ZodType<I>;
  /** Property schemas the planner may fill in `args` (all optional/nullable in the model's output). */
  readonly argsJsonSchema: Record<string, LlmSchema>;
  /** Spends AI / research-engine budget → the plan badges it. */
  readonly costly: boolean;
  /** This step's output includes a `leadIds` list that later steps may reference with `from`. */
  readonly producesLeadIds: boolean;
  available(services: AgentServices): boolean;
  /** Why the tool is unavailable when `available()` is false — the planner is told, so it says so instead of substituting. */
  readonly unavailableNote?: string;
  /** Clamp/clean model-produced args (e.g. cap a limit) and say what was changed. Runs before validation. */
  normalizeArgs?(args: Record<string, unknown>): { args: Record<string, unknown>; warnings: string[] };
  estimate(ctx: { workspaceId: number; services: AgentServices }, input: I, deps: Record<string, number | null>): Promise<{ records: number | null; note: string | null }>;
  run(ctx: ToolCtx, input: I, inputs: ToolRunInput): Promise<ToolOutcome>;
}
