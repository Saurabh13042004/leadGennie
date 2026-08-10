import { sql } from "@/lib/db/client";

export type ExtensionAuthContext = {
  workspaceId: number;
  ownerEmail: string;
};

/**
 * Shared by every /api/extension/* route the Chrome extension calls — the
 * same per-workspace token minted in lib/actions/api-tokens.ts and shown on
 * /dashboard/api-credentials. Keep this the one place that checks it so
 * every extension endpoint enforces auth identically.
 */
export async function extensionAuthFromRequest(request: Request): Promise<ExtensionAuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const rows = await sql`select workspace_id, owner_email from api_tokens where token = ${token}`;
  if (rows.length === 0) return null;

  await sql`update api_tokens set last_used_at = now() where token = ${token}`;
  return { workspaceId: rows[0].workspace_id as number, ownerEmail: rows[0].owner_email as string };
}
