import type { Tone } from "@/components/ui/Badge";

/** Badge tone + label for domain / DNS record / mailbox statuses. Unknown statuses fall back to neutral. */
const STATUS: Record<string, { tone: Tone; label: string }> = {
  verified: { tone: "emerald", label: "Verified" },
  pending: { tone: "amber", label: "Pending" },
  not_started: { tone: "neutral", label: "Not started" },
  failed: { tone: "rose", label: "Failed" },
  partially_verified: { tone: "amber", label: "Partially verified" },
  partially_failed: { tone: "rose", label: "Partially failed" },
  temporary_failure: { tone: "rose", label: "Temporary failure" },
  active: { tone: "emerald", label: "Active" },
  pending_approval: { tone: "indigo", label: "Pending approval" },
  paused: { tone: "amber", label: "Paused" },
};

export function statusMeta(status: string): { tone: Tone; label: string } {
  return STATUS[status] ?? { tone: "neutral", label: status.replace(/_/g, " ") };
}

const RANK: Record<Tone, number> = { rose: 0, amber: 1, neutral: 2, indigo: 2, sky: 2, violet: 2, orange: 1, emerald: 3 };

/** The "worst" tone among several statuses (a DKIM group is only green when every record is). */
export function worstTone(statuses: string[]): Tone {
  return statuses.map((s) => statusMeta(s).tone).sort((a, b) => RANK[a] - RANK[b])[0] ?? "neutral";
}
