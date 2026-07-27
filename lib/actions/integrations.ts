"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { revokeHubspotRefreshToken } from "@/lib/hubspot";
import { requireRole } from "@/lib/auth/workspace-context";
import { decryptSecret } from "@/lib/crypto";

export type CrmConnection = {
  id: number;
  provider: string;
  label: string | null;
  portal_id: string | null;
  status: string;
  expires_at: string;
  created_at: string;
};

export async function listConnections(): Promise<CrmConnection[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, provider, label, portal_id, status, expires_at, created_at
    from crm_connections
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;
  return rows as CrmConnection[];
}

export async function disconnectConnection(id: number) {
  const { workspaceId } = await requireRole("admin");

  const rows = await sql`
    select refresh_token from crm_connections
    where id = ${id} and workspace_id = ${workspaceId}
  `;
  const encryptedRefreshToken = rows[0]?.refresh_token as string | undefined;

  await sql`
    delete from crm_connections
    where id = ${id} and workspace_id = ${workspaceId}
  `;

  if (encryptedRefreshToken) {
    await revokeHubspotRefreshToken(decryptSecret(encryptedRefreshToken));
  }

  revalidatePath("/dashboard/integrations");
}
