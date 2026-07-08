"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

export type SenderProfile = {
  company: string | null;
  pitch: string | null;
};

export async function getSenderProfile(): Promise<SenderProfile> {
  const owner = await requireOwnerEmail();
  const rows = await sql`select company, pitch from users where email = ${owner}`;
  return {
    company: (rows[0]?.company as string | null) ?? null,
    pitch: (rows[0]?.pitch as string | null) ?? null,
  };
}

export async function updateSenderPitch(pitch: string) {
  const owner = await requireOwnerEmail();
  await sql`update users set pitch = ${pitch} where email = ${owner}`;
}
