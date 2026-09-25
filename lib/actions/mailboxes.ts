"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { createApprovalRequest } from "@/lib/approvals-core";
import { AppError, runAction, type ActionResult } from "@/lib/api";
import { pauseMailbox as pauseMailboxRow, resumeMailbox as resumeMailboxRow } from "@/lib/domain/mailboxes/lifecycle";
import { getOAuthClient } from "@/lib/domain/mailboxes/oauth/registry";
import { listMailboxes as listWorkspaceMailboxes } from "@/lib/domain/mailboxes/repository";
import { disconnectMailbox as disconnectMailboxService, sendTestEmail as sendMailboxTestEmail } from "@/lib/domain/mailboxes/service";
import type { Mailbox } from "@/lib/domain/mailboxes/types";

export type { Mailbox } from "@/lib/domain/mailboxes/types";

export async function listMailboxes(): Promise<Mailbox[]> {
  const { workspaceId } = await requireRole("viewer");
  return listWorkspaceMailboxes(workspaceId);
}

/** Only mailboxes that can send right now can be picked for a campaign (connected/active, and for Resend a verified domain). */
export async function listSendableMailboxes(): Promise<Mailbox[]> {
  return (await listMailboxes()).filter((m) => m.sendable);
}

/** Which sign-in providers this server has credentials for — so the UI can say "not set up" instead of sending users into an error. */
export async function getConnectAvailability(): Promise<{ gmail: boolean; microsoft: boolean }> {
  await requireRole("viewer");
  return { gmail: getOAuthClient("gmail").isConfigured(), microsoft: getOAuthClient("microsoft").isConfigured() };
}

/** DEL-02: adding a mailbox always creates an approval request — it never becomes active on its own. */
export async function requestAddMailbox(input: { email: string; domainId: number; dailyLimit: number }) {
  const { workspaceId, userId } = await requireRole("member");
  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email address.");
  if (input.dailyLimit <= 0) throw new Error("Daily limit must be positive.");

  const domainRows = await sql`select name from domains where id = ${input.domainId} and workspace_id = ${workspaceId}`;
  if (domainRows.length === 0) throw new Error("Domain not found in this workspace.");
  const domainName = domainRows[0].name as string;

  if (!email.endsWith(`@${domainName}`)) {
    throw new Error(`Mailbox address must belong to ${domainName}.`);
  }

  const inserted = await sql`
    insert into mailboxes (workspace_id, domain_id, email, status, daily_limit, created_by_user_id)
    values (${workspaceId}, ${input.domainId}, ${email}, 'pending_approval', ${input.dailyLimit}, ${userId})
    returning id
  `;
  const mailboxId = inserted[0].id as number;

  const approvalId = await createApprovalRequest({
    workspaceId,
    type: "mailbox_add",
    entityType: "mailbox",
    entityId: mailboxId,
    title: `Add mailbox ${email}`,
    summary: `+${input.dailyLimit} daily send capacity on ${domainName}`,
    payload: { email, domainId: input.domainId, dailyLimit: input.dailyLimit },
    requestedByUserId: userId,
  });

  await sql`update mailboxes set approval_id = ${approvalId} where id = ${mailboxId} and workspace_id = ${workspaceId}`;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "mailbox.requested",
    entityType: "mailbox",
    entityId: mailboxId,
    summary: `Requested to add mailbox ${email}`,
  });

  revalidatePath("/dashboard/deliverability");
  return { id: mailboxId, approvalId };
}

/** DEL-02: raising a limit is also approval-gated — the mailbox keeps its current limit until approved. */
export async function requestLimitIncrease(mailboxId: number, newLimit: number) {
  const { workspaceId, userId } = await requireRole("member");
  if (newLimit <= 0) throw new Error("Daily limit must be positive.");

  const rows = await sql`
    select email, daily_limit from mailboxes where id = ${mailboxId} and workspace_id = ${workspaceId} and status = 'active'
  `;
  if (rows.length === 0) throw new Error("Mailbox not found or not active.");
  const current = rows[0].daily_limit as number;
  if (newLimit <= current) throw new Error("New limit must be higher than the current limit.");

  const approvalId = await createApprovalRequest({
    workspaceId,
    type: "mailbox_limit_change",
    entityType: "mailbox",
    entityId: mailboxId,
    title: `Raise limit for ${rows[0].email}`,
    summary: `${current} → ${newLimit} emails/day (+${newLimit - current})`,
    payload: { mailboxId, currentLimit: current, newLimit },
    requestedByUserId: userId,
  });

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "mailbox.limit_increase_requested",
    entityType: "mailbox",
    entityId: mailboxId,
    summary: `Requested limit increase for ${rows[0].email}: ${current} → ${newLimit}`,
  });

  revalidatePath("/dashboard/deliverability");
  return { approvalId };
}

export async function pauseMailbox(id: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    await pauseMailboxRow(workspaceId, id, userId);
    revalidatePath("/dashboard/deliverability");
    return null;
  });
}

export async function resumeMailbox(id: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    await resumeMailboxRow(workspaceId, id, userId);
    revalidatePath("/dashboard/deliverability");
    return null;
  });
}

/** Resend mailboxes only: an OAuth mailbox is disconnected (history stays), never deleted. */
export async function removeMailbox(id: number): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    const rows = await sql`delete from mailboxes where id = ${id} and workspace_id = ${workspaceId} and provider = 'resend' returning email`;
    if (rows.length === 0) throw new AppError("NOT_FOUND", "Mailbox not found, or it's a connected account — disconnect it instead.");
    await logActivity({ workspaceId, actorUserId: userId, type: "mailbox.removed", entityType: "mailbox", entityId: id, summary: `Removed mailbox ${rows[0].email}` });
    revalidatePath("/dashboard/deliverability");
    return null;
  });
}

/** Revoke where the provider supports it, forget the credentials, stop campaigns that use it. History is kept. */
export async function disconnectMailbox(id: number): Promise<ActionResult<{ email: string; campaignsPaused: number; revoked: boolean }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    const done = await disconnectMailboxService({ workspaceId, userId }, id);
    revalidatePath("/dashboard/deliverability");
    revalidatePath("/dashboard/campaigns");
    return done;
  });
}

/** Sends a test message from the mailbox to the signed-in user. Any member may — it can only ever reach their own address. */
export async function testMailbox(id: number): Promise<ActionResult<{ to: string }>> {
  return runAction(async () => {
    const { workspaceId, userId, email } = await requireRole("member");
    const done = await sendMailboxTestEmail({ workspaceId, userId, email }, id);
    revalidatePath("/dashboard/deliverability");
    return done;
  });
}
