import { sql } from "@/lib/db/client";
import type { SenderIdentity } from "@/lib/campaigns/render";

export async function loadSenderIdentity(workspaceId: number): Promise<SenderIdentity> {
  const rows = await sql`select sender_name, sender_address from workspaces where id = ${workspaceId}`;
  return { name: (rows[0]?.sender_name as string | null) ?? null, address: (rows[0]?.sender_address as string | null) ?? null };
}

export async function saveSenderIdentity(workspaceId: number, identity: { name: string; address: string }): Promise<void> {
  await sql`update workspaces set sender_name = ${identity.name.trim() || null}, sender_address = ${identity.address.trim() || null} where id = ${workspaceId}`;
}

/**
 * RFC 8058 one-click unsubscribe headers. With these mail clients (Gmail, Yahoo, Apple) show a native "Unsubscribe"
 * button that POSTs to the URL — which is why /api/unsubscribe accepts POST, not only GET.
 */
export function complianceHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
