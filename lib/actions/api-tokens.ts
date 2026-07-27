"use server";

import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";

export async function getOrCreateApiToken(): Promise<string> {
  const { workspaceId, email: owner } = await requireRole("admin");

  const existing = await sql`select token from api_tokens where workspace_id = ${workspaceId}`;
  if (existing.length > 0) return existing[0].token as string;

  const token = randomBytes(24).toString("hex");
  await sql`
    insert into api_tokens (workspace_id, owner_email, token)
    values (${workspaceId}, ${owner}, ${token})
  `;
  return token;
}

export async function regenerateApiToken(): Promise<string> {
  const { workspaceId, email: owner } = await requireRole("admin");
  const token = randomBytes(24).toString("hex");

  await sql`
    insert into api_tokens (workspace_id, owner_email, token)
    values (${workspaceId}, ${owner}, ${token})
    on conflict (workspace_id) do update set token = excluded.token, owner_email = excluded.owner_email, created_at = now(), last_used_at = null
  `;

  revalidatePath("/dashboard/api-credentials");
  return token;
}
