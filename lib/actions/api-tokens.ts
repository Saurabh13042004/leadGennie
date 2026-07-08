"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

export async function getOrCreateApiToken(): Promise<string> {
  const owner = await requireOwnerEmail();

  const existing = await sql`select token from api_tokens where owner_email = ${owner}`;
  if (existing.length > 0) return existing[0].token as string;

  const token = randomBytes(24).toString("hex");
  await sql`
    insert into api_tokens (owner_email, token)
    values (${owner}, ${token})
  `;
  return token;
}

export async function regenerateApiToken(): Promise<string> {
  const owner = await requireOwnerEmail();
  const token = randomBytes(24).toString("hex");

  await sql`
    insert into api_tokens (owner_email, token)
    values (${owner}, ${token})
    on conflict (owner_email) do update set token = excluded.token, created_at = now(), last_used_at = null
  `;

  revalidatePath("/dashboard/api-credentials");
  return token;
}
