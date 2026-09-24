"use server";

import { sql } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/workspace-context";
import { getSenderContext, updateWorkspaceProfile } from "@/lib/db/workspace-profile";
import { logActivity } from "@/lib/activity";

/**
 * Legacy sender-profile actions, kept working for the campaign wizard.
 * D-07: positioning now lives on the workspace. Writes go to BOTH the workspace
 * (the source of truth) and users.pitch (legacy, dropped in a later release);
 * reads prefer the workspace and fall back to the user's old value.
 */

export type SenderProfile = {
  company: string | null;
  pitch: string | null;
};

export async function getSenderProfile(): Promise<SenderProfile> {
  const { workspaceId, userId } = await requireRole("viewer");
  return getSenderContext(workspaceId, userId);
}

export async function updateSenderPitch(pitch: string) {
  const { workspaceId, userId } = await requireRole("member");
  const trimmed = pitch.trim().slice(0, 2000);
  await updateWorkspaceProfile(workspaceId, { positioning: trimmed || null });
  await sql`update users set pitch = ${trimmed || null} where id = ${userId}`;
  await logActivity({
    workspaceId, actorUserId: userId, type: "workspace.profile_updated", entityType: "workspace", entityId: workspaceId,
    summary: "Updated positioning",
  });
}
