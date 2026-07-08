"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { revokeHubspotRefreshToken } from "@/lib/hubspot";

export type CrmConnection = {
  id: number;
  provider: string;
  label: string | null;
  portal_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

export async function listConnections(): Promise<CrmConnection[]> {
  const owner = await requireOwnerEmail();
  const rows = await sql`
    select id, provider, label, portal_id, status, expires_at, created_at
    from crm_connections
    where owner_email = ${owner}
    order by created_at desc
  `;
  return rows as CrmConnection[];
}

export async function disconnectConnection(id: number) {
  const owner = await requireOwnerEmail();

  const rows = await sql`
    select refresh_token from crm_connections
    where id = ${id} and owner_email = ${owner}
  `;
  const refreshToken = rows[0]?.refresh_token as string | undefined;

  await sql`
    delete from crm_connections
    where id = ${id} and owner_email = ${owner}
  `;

  if (refreshToken) {
    await revokeHubspotRefreshToken(refreshToken);
  }

  revalidatePath("/dashboard/integrations");
}
