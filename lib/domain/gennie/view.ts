import type { RankedLead } from "@/lib/agent/tools/types";
import type { Plan, StepStatus } from "@/lib/agent/types";
import type { GennieRunStatus } from "@/lib/db/gennie";

/** Plain, serializable shapes the Command Center UI renders (no server-only imports, safe in client components). */

export type StepView = {
  id: string;
  tool: string;
  label: string;
  status: StepStatus;
  costly: boolean;
  rationale: string;
  summary: string | null;
  error: string | null;
  estimatedRecords: number | null;
  estimateNote: string | null;
};

export type RunResults = {
  considered: number;
  researched: number;
  qualified: number;
  researchFailed: number;
  avgIcpScore: number | null;
  /** From the rank step, when the plan had one. */
  ranked: RankedLead[] | null;
  /** Leads Gennie skipped or failed on, with the reason — never silently dropped. */
  problems: { leadId: number; name: string; reason: string }[];
};

export type GennieRunView = {
  id: number;
  status: GennieRunStatus;
  prompt: string;
  createdAt: string;
  completedAt: string | null;
  error: string | null;
  plan: Plan | null;
  steps: StepView[];
  /** Live counters for the running research step, derived from its jobs. */
  live: { done: number; total: number; failed: number } | null;
  results: RunResults | null;
  canApprove: boolean;
  /** Still moving (or could move): the UI keeps polling. */
  active: boolean;
};

export type RecentRun = { id: number; status: GennieRunStatus; prompt: string; createdAt: string };

export type GennieHome = { suggestions: string[]; recent: RecentRun[]; leadCount: number; engineAvailable: boolean };
