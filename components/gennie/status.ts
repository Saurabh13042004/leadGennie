import type { StepStatus } from "@/lib/agent/types";
import type { GennieRunStatus } from "@/lib/db/gennie";

export const RUN_STATUS: Record<GennieRunStatus, { label: string; tone: string }> = {
  planned: { label: "Nothing to run", tone: "bg-white/5 text-neutral-300 border-white/10" },
  awaiting_approval: { label: "Waiting for your approval", tone: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  running: { label: "Running", tone: "bg-blue-500/10 text-blue-300 border-blue-500/20" },
  paused: { label: "Paused", tone: "bg-amber-500/10 text-amber-300 border-amber-500/20" },
  completed: { label: "Completed", tone: "bg-green-500/10 text-green-300 border-green-500/20" },
  failed: { label: "Failed", tone: "bg-red-500/10 text-red-300 border-red-500/20" },
  canceled: { label: "Canceled", tone: "bg-white/5 text-neutral-400 border-white/10" },
};

export const STEP_STATUS: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
  canceled: "Canceled",
};
