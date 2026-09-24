"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { apiTokenPrefix, generateApiToken, hashApiToken } from "@/lib/auth/api-token-core";
import { logActivity } from "@/lib/activity";

export type ApiTokenInfo = {
  exists: boolean;
  prefix: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
};

/** Metadata only — the token itself is never recoverable after creation. */
export async function getApiTokenInfo(): Promise<ApiTokenInfo> {
  const { workspaceId } = await requireRole("admin");
  const rows = await sql`
    select token_prefix, created_at, last_used_at from api_tokens where workspace_id = ${workspaceId}
  `;
  if (rows.length === 0) return { exists: false, prefix: null, createdAt: null, lastUsedAt: null };
  const row = rows[0];
  return {
    exists: true,
    prefix: (row.token_prefix as string | null) ?? null,
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string).toISOString() : null,
  };
}

/**
 * Creates (or replaces) the workspace's token and returns the plaintext ONCE.
 * Replacing invalidates the previous token immediately.
 */
export async function regenerateApiToken(): Promise<string> {
  const { workspaceId, userId } = await requireRole("admin");
  const token = generateApiToken();

  await sql`
    insert into api_tokens (workspace_id, token_hash, token_prefix)
    values (${workspaceId}, ${hashApiToken(token)}, ${apiTokenPrefix(token)})
    on conflict (workspace_id) do update
      set token_hash = excluded.token_hash,
          token_prefix = excluded.token_prefix,
          token = null,
          created_at = now(),
          last_used_at = null
  `;

  await logActivity({
    workspaceId,
    actorUserId: Number.isFinite(userId) ? userId : null,
    type: "api_token.regenerated",
    entityType: "workspace",
    entityId: workspaceId,
    summary: "API token regenerated",
  });

  revalidatePath("/dashboard/api-credentials");
  return token;
}
