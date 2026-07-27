"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { createApprovalRequest } from "@/lib/approvals-core";

export type Mailbox = {
  id: number;
  email: string;
  provider: string;
  status: string;
  dailyLimit: number;
  sentToday: number;
  domainId: number;
  domainName: string;
  domainStatus: string;
  approvalId: number | null;
  createdAt: string;
};

export async function listMailboxes(): Promise<Mailbox[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select
      m.id, m.email, m.provider, m.status, m.daily_limit, m.domain_id, m.approval_id, m.created_at,
      d.name as domain_name, d.status as domain_status,
      (
        select count(*)::int from campaign_sends cs
        where cs.workspace_id = m.workspace_id
          and cs.channel = 'email'
          and cs.status = 'sent'
          and cs.sent_at::date = current_date
      ) as sent_today
    from mailboxes m
    join domains d on d.id = m.domain_id
    where m.workspace_id = ${workspaceId}
    order by m.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    email: r.email as string,
    provider: r.provider as string,
    status: r.status as string,
    dailyLimit: r.daily_limit as number,
    sentToday: r.sent_today as number,
    domainId: r.domain_id as number,
    domainName: r.domain_name as string,
    domainStatus: r.domain_status as string,
    approvalId: r.approval_id as number | null,
    createdAt: r.created_at as string,
  }));
}

/** DEL-01: only mailboxes that are active AND on a currently-verified domain can be picked for a campaign. */
export async function listSendableMailboxes(): Promise<Mailbox[]> {
  const all = await listMailboxes();
  return all.filter((m) => m.status === "active" && m.domainStatus === "verified");
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

  await sql`update mailboxes set approval_id = ${approvalId} where id = ${mailboxId}`;

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

export async function pauseMailbox(id: number) {
  const { workspaceId, userId } = await requireRole("admin");
  const rows = await sql`
    update mailboxes set status = 'paused' where id = ${id} and workspace_id = ${workspaceId} and status = 'active'
    returning email
  `;
  if (rows.length === 0) throw new Error("Mailbox not found or not active.");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "mailbox.paused",
    entityType: "mailbox",
    entityId: id,
    summary: `Paused mailbox ${rows[0].email}`,
  });
  revalidatePath("/dashboard/deliverability");
}

export async function resumeMailbox(id: number) {
  const { workspaceId, userId } = await requireRole("admin");
  const rows = await sql`
    update mailboxes set status = 'active' where id = ${id} and workspace_id = ${workspaceId} and status = 'paused'
    returning email
  `;
  if (rows.length === 0) throw new Error("Mailbox not found or not paused.");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "mailbox.resumed",
    entityType: "mailbox",
    entityId: id,
    summary: `Resumed mailbox ${rows[0].email}`,
  });
  revalidatePath("/dashboard/deliverability");
}

export async function removeMailbox(id: number) {
  const { workspaceId, userId } = await requireRole("admin");
  const rows = await sql`delete from mailboxes where id = ${id} and workspace_id = ${workspaceId} returning email`;
  if (rows.length === 0) throw new Error("Mailbox not found");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "mailbox.removed",
    entityType: "mailbox",
    entityId: id,
    summary: `Removed mailbox ${rows[0].email}`,
  });
  revalidatePath("/dashboard/deliverability");
}
