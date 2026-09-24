import type { StepStatus } from "@/lib/agent/types";
import type { GennieRunStatus } from "@/lib/db/gennie";

export const RUN_STATUS: Record<GennieRunStatus, { label: string; tone: string }> = {
  planned: { label: "Nothing to run", tone: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200" },
  awaiting_approval: { label: "Waiting for your approval", tone: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
  running: { label: "Running", tone: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200" },
  paused: { label: "Paused", tone: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200" },
  completed: { label: "Completed", tone: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" },
  failed: { label: "Failed", tone: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200" },
  canceled: { label: "Canceled", tone: "bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200" },
};

export const STEP_STATUS: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
  canceled: "Canceled",
};
