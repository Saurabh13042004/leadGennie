"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import {
  createResendDomain,
  findResendDomainByName,
  getResendDomain,
  verifyResendDomain,
  removeResendDomain,
} from "@/lib/email/resend-domains";

export type DomainRecordView = { record: string; name: string; value: string; type: string; ttl: string; status: string };

export type Domain = {
  id: number;
  name: string;
  status: string;
  region: string | null;
  records: DomainRecordView[];
  createdAt: string;
  lastCheckedAt: string | null;
};

export async function listDomains(): Promise<Domain[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, name, status, region, records, created_at, last_checked_at
    from domains where workspace_id = ${workspaceId} order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    status: r.status as string,
    region: r.region as string | null,
    records: r.records as DomainRecordView[],
    createdAt: r.created_at as string,
    lastCheckedAt: r.last_checked_at as string | null,
  }));
}

/** DEL-01: this is the only way a domain enters the system — always via Resend's real Domains API, never a hand-typed "trust me" entry. */
export async function addDomain(name: string) {
  const { workspaceId, userId } = await requireRole("admin");
  const trimmed = name.trim().toLowerCase();
  if (!trimmed || !trimmed.includes(".")) throw new Error("Enter a valid domain name.");

  let resendDomain;
  try {
    resendDomain = await createResendDomain(trimmed);
  } catch (err) {
    // Resend rejects `create` if this domain is already registered under the
    // account (e.g. set up directly in the Resend dashboard). Adopt the
    // existing domain instead of failing, rather than requiring the user to
    // delete and recreate it on Resend just to satisfy our own bookkeeping.
    const existing = await findResendDomainByName(trimmed);
    if (!existing) throw err;
    resendDomain = existing;
  }

  const inserted = await sql`
    insert into domains (workspace_id, resend_domain_id, name, status, region, records, created_by_user_id, last_checked_at)
    values (${workspaceId}, ${resendDomain.id}, ${trimmed}, ${resendDomain.status}, ${resendDomain.region},
      ${JSON.stringify(resendDomain.records)}, ${userId}, now())
    returning id
  `;
  const domainId = inserted[0].id as number;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "domain.added",
    entityType: "domain",
    entityId: domainId,
    summary: `Added sending domain "${trimmed}"`,
  });

  revalidatePath("/dashboard/deliverability");
  return { id: domainId };
}

export async function refreshDomain(id: number) {
  const { workspaceId } = await requireRole("member");
  const rows = await sql`select resend_domain_id from domains where id = ${id} and workspace_id = ${workspaceId}`;
  if (rows.length === 0) throw new Error("Domain not found");

  const resendDomain = await getResendDomain(rows[0].resend_domain_id as string);

  await sql`
    update domains set status = ${resendDomain.status}, records = ${JSON.stringify(resendDomain.records)}, last_checked_at = now()
    where id = ${id} and workspace_id = ${workspaceId}
  `;
  revalidatePath("/dashboard/deliverability");
}

export async function triggerVerify(id: number) {
  const { workspaceId, userId } = await requireRole("admin");
  const rows = await sql`select resend_domain_id from domains where id = ${id} and workspace_id = ${workspaceId}`;
  if (rows.length === 0) throw new Error("Domain not found");

  await verifyResendDomain(rows[0].resend_domain_id as string);
  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "domain.verify_requested",
    entityType: "domain",
    entityId: id,
    summary: "Requested a DNS re-check from Resend",
  });

  await refreshDomain(id);
}

export async function removeDomain(id: number) {
  const { workspaceId, userId } = await requireRole("admin");

  const mailboxCount = await sql`select count(*)::int as count from mailboxes where domain_id = ${id}`;
  if ((mailboxCount[0].count as number) > 0) {
    throw new Error("Remove or reassign this domain's mailboxes first.");
  }

  const rows = await sql`
    delete from domains where id = ${id} and workspace_id = ${workspaceId} returning resend_domain_id, name
  `;
  if (rows.length === 0) throw new Error("Domain not found");

  await removeResendDomain(rows[0].resend_domain_id as string);

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "domain.removed",
    entityType: "domain",
    entityId: id,
    summary: `Removed sending domain "${rows[0].name}"`,
  });

  revalidatePath("/dashboard/deliverability");
}
