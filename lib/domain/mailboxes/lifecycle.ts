import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { pauseCampaignBySystem } from "@/lib/domain/sending/failures";
import { clearConnection, listRunningCampaigns, moveStatus } from "./repository";
import { canTransitionMailbox, MAILBOX_STATUSES, type MailboxStatus } from "./types";

/**
 * Mailbox status changes, each with its audit entry. Every change goes through `moveStatus`, which only applies if the mailbox is
 * still in an allowed source status — so racing writers (a user clicking Pause while a worker marks the token dead) can't both win.
 * Called by user actions AND by the token source (system actor, `actorUserId: null`).
 */

/** Statuses a mailbox may be moved out of to reach `to`, per the transition table — the table is the single source of truth. */
const sourcesFor = (to: MailboxStatus): MailboxStatus[] => MAILBOX_STATUSES.filter((from) => canTransitionMailbox(from, to));

async function move(workspaceId: number, mailboxId: number, to: MailboxStatus, actorUserId: number | null, lastError: string | null, activity: { type: string; summary: (email: string) => string }, from: readonly MailboxStatus[] = sourcesFor(to)) {
  const moved = await moveStatus(workspaceId, mailboxId, from, to, lastError);
  if (!moved) return null;
  await logActivity({ workspaceId, actorUserId, type: activity.type, entityType: "mailbox", entityId: mailboxId, summary: activity.summary(moved.email), metadata: { provider: moved.provider } });
  return moved;
}

/** Stops every running campaign that sends through this mailbox. They stay resumable: nothing is deleted, sends stay pending. */
export async function pauseCampaignsUsing(workspaceId: number, mailboxId: number, reason: string): Promise<number> {
  const running = await listRunningCampaigns(workspaceId, mailboxId);
  let paused = 0;
  for (const c of running) if (await pauseCampaignBySystem(workspaceId, c.id, reason)) paused++;
  return paused;
}

export async function pauseMailbox(workspaceId: number, mailboxId: number, actorUserId: number): Promise<void> {
  const moved = await move(workspaceId, mailboxId, "paused", actorUserId, null, { type: "mailbox.paused", summary: (e) => `Paused mailbox ${e}` }, ["active", "error"]);
  if (!moved) throw new AppError("CONFLICT", "That mailbox can't be paused right now — it must be connected.");
}

export async function resumeMailbox(workspaceId: number, mailboxId: number, actorUserId: number): Promise<void> {
  const moved = await move(workspaceId, mailboxId, "active", actorUserId, null, { type: "mailbox.resumed", summary: (e) => `Resumed mailbox ${e}` }, ["paused"]);
  if (!moved) throw new AppError("CONFLICT", "Only a paused mailbox can be resumed.");
}

/**
 * The provider refused our credentials for good (refresh token revoked or expired, permission removed). Idempotent: a second
 * failure while already `reconnect_required` changes nothing and logs nothing. Never receives or logs the credentials themselves.
 */
export async function markReconnectRequired(workspaceId: number, mailboxId: number, reason: string): Promise<boolean> {
  const moved = await move(workspaceId, mailboxId, "reconnect_required", null, reason.slice(0, 300), {
    type: "mailbox.auth_failed", summary: (e) => `${e} needs to be reconnected: the provider no longer accepts its sign-in`,
  }, ["active", "paused", "error"]);
  if (!moved) return false;
  await pauseCampaignsUsing(workspaceId, mailboxId, "Your mailbox needs to be reconnected before LeadGennie can continue sending. Reconnect it in Settings → Mailboxes, then resume.");
  return true;
}

/** The mailbox's provider setup is broken in a way reconnecting won't fix (Gmail API disabled, no Exchange mailbox). Shown as an error. */
export async function markMailboxError(workspaceId: number, mailboxId: number, reason: string): Promise<boolean> {
  const moved = await move(workspaceId, mailboxId, "error", null, reason.slice(0, 300), { type: "mailbox.error", summary: (e) => `Mailbox ${e} can't send: ${reason.slice(0, 160)}` }, ["active"]);
  return moved !== null;
}

/** A successful send/test proves an `error` mailbox works again. */
export async function clearMailboxError(workspaceId: number, mailboxId: number): Promise<void> {
  await moveStatus(workspaceId, mailboxId, ["error"], "active", null);
}

/** Forget the credentials, mark it disconnected, stop the campaigns that use it. History (messages, threads, analytics) is untouched. */
export async function markDisconnected(workspaceId: number, mailboxId: number, actorUserId: number): Promise<{ email: string; campaignsPaused: number }> {
  const cleared = await clearConnection(workspaceId, mailboxId);
  if (!cleared) throw new AppError("CONFLICT", "That mailbox is already disconnected.");
  const campaignsPaused = await pauseCampaignsUsing(workspaceId, mailboxId, `The sending mailbox ${cleared.email} was disconnected. Connect a mailbox, pick it in the campaign, then resume.`);
  await logActivity({
    workspaceId, actorUserId, type: "mailbox.disconnected", entityType: "mailbox", entityId: mailboxId,
    summary: `Disconnected mailbox ${cleared.email}${campaignsPaused ? ` and paused ${campaignsPaused} running campaign${campaignsPaused === 1 ? "" : "s"}` : ""}`,
  });
  return { email: cleared.email, campaignsPaused };
}
