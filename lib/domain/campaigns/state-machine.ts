import { AppError } from "@/lib/api/errors";
import type { CampaignStatus } from "./types";

/**
 * The campaign lifecycle as data. Anything not listed is an illegal transition and throws — there is no path from
 * `pending_approval` (or `rejected`) to `running` that skips approval, and terminal states never move.
 *
 *   draft → pending_approval → ready → running ⇄ paused → completed | failed
 *   any non-terminal → canceled;  pending_approval → rejected → draft (edit and resubmit)
 *   A pending request can't be pulled back for editing: the approver rejects it (or it is canceled) — so an approver
 *   never approves content that changed under them.
 *   ready → draft: editing an approved campaign sends it back for approval (the approval covered the old content).
 */
export const TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  draft: ["pending_approval", "canceled"],
  pending_approval: ["ready", "rejected", "canceled"],
  rejected: ["draft", "canceled"],
  ready: ["running", "draft", "canceled"],
  running: ["paused", "completed", "failed", "canceled"],
  paused: ["running", "canceled"],
  completed: [],
  failed: [],
  canceled: [],
};

export const TERMINAL: readonly CampaignStatus[] = ["completed", "failed", "canceled"];

export const canTransition = (from: CampaignStatus, to: CampaignStatus) => TRANSITIONS[from].includes(to);

export function assertTransition(from: CampaignStatus, to: CampaignStatus): void {
  if (!canTransition(from, to)) {
    throw new AppError("CONFLICT", `A ${from.replace("_", " ")} campaign can't become ${to.replace("_", " ")}.`);
  }
}

/** Structure (steps, mailbox, audience, limits) can be rewritten only before approval. */
export const isStructureEditable = (s: CampaignStatus) => s === "draft" || s === "rejected";

/** Copy of steps that haven't sent yet can still be edited while a campaign runs; approved-but-unlaunched edits reopen approval. */
export const isContentEditable = (s: CampaignStatus) => isStructureEditable(s) || s === "ready" || s === "running" || s === "paused";

/** Statuses in which a campaign occupies its leads (they count as "already in another active campaign"). */
export const OCCUPYING: readonly CampaignStatus[] = ["ready", "running", "paused"];
