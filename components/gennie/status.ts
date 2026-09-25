import type { StepStatus } from "@/lib/agent/types";
import type { GennieRunStatus } from "@/lib/db/gennie";
import type { Tone } from "@/components/ui/Badge";

/** Presentation for a run's status: label + Badge tone. `pulse` marks states that are still moving. */
export const RUN_STATUS: Record<GennieRunStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  planned: { label: "Nothing to run", tone: "neutral" },
  awaiting_approval: { label: "Waiting for your approval", tone: "amber", pulse: true },
  running: { label: "Running", tone: "indigo", pulse: true },
  paused: { label: "Paused", tone: "amber" },
  completed: { label: "Completed", tone: "emerald" },
  failed: { label: "Failed", tone: "rose" },
  canceled: { label: "Canceled", tone: "neutral" },
};

export const STEP_STATUS: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "In progress",
  succeeded: "Done",
  failed: "Failed",
  skipped: "Skipped",
  canceled: "Canceled",
};

/** "3m ago" style relative time. Server-rendered only (the recent list), so no hydration drift. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
