import { sql } from "@/lib/db/client";
import { hashApiToken } from "@/lib/auth/api-token-core";

export type ExtensionAuthContext = {
  workspaceId: number;
};

/**
 * Shared by every /api/extension/* route the Chrome extension calls — the
 * same per-workspace token minted in lib/actions/api-tokens.ts and managed on
 * /dashboard/api-credentials. Keep this the one place that checks it so
 * every extension endpoint enforces auth identically.
 *
 * Tokens are stored hashed (migration 0004); we hash what the client sends
 * and compare. Returns null for a missing or unknown token.
 */
export async function extensionAuthFromRequest(request: Request): Promise<ExtensionAuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const rows = await sql`
    update api_tokens set last_used_at = now()
    where token_hash = ${hashApiToken(token)}
    returning workspace_id
  `;
  if (rows.length === 0) return null;

  return { workspaceId: Number(rows[0].workspace_id) };
}
