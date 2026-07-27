"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";

export type DncEntry = {
  id: number;
  email: string;
  reason: string | null;
  source: string;
  createdAt: string;
};

export async function listDncEntries(): Promise<DncEntry[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, email, reason, source, created_at
    from do_not_contact
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    email: r.email as string,
    reason: r.reason as string | null,
    source: r.source as string,
    createdAt: r.created_at as string,
  }));
}

export async function addDncEntry(email: string, reason?: string) {
  const { workspaceId, userId } = await requireRole("member");
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    throw new Error("Enter a valid email address.");
  }

  await sql`
    insert into do_not_contact (workspace_id, email, reason, source, created_by_user_id)
    values (${workspaceId}, ${trimmed}, ${reason?.trim() || null}, 'manual', ${userId})
    on conflict (workspace_id, lower(email)) do update set reason = excluded.reason
  `;
  revalidatePath("/dashboard/do-not-contact");
}

export async function removeDncEntry(id: number) {
  const { workspaceId } = await requireRole("admin");
  await sql`delete from do_not_contact where id = ${id} and workspace_id = ${workspaceId}`;
  revalidatePath("/dashboard/do-not-contact");
}
