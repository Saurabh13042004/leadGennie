"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { draftMessage, type Channel } from "@/lib/ai/messages";

export async function generateSequenceStepMessage(input: {
  channel: Channel;
  stepIndex: number;
  audienceLabel: string;
  audiencePrompt?: string | null;
  campaignName?: string;
}) {
  const session = await auth();
  const owner = session?.user?.email;
  if (!owner) throw new Error("Not authenticated");

  const rows = await sql`select company, pitch from users where email = ${owner}`;
  const senderCompany = (rows[0]?.company as string | null) ?? null;
  const senderPitch = (rows[0]?.pitch as string | null) ?? null;

  return draftMessage({ ...input, senderCompany, senderPitch });
}
