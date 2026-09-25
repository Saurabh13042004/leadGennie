"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { runAction, type ActionResult } from "@/lib/api";
import { loadSenderIdentity, saveSenderIdentity } from "@/lib/domain/sending/identity";
import { retryFailedSend, skipFailedSend } from "@/lib/domain/sending/failures";
import type { SenderIdentity } from "@/lib/campaigns/render";

const idSchema = z.number().int().positive();

export async function getSenderIdentity(): Promise<SenderIdentity> {
  const { workspaceId } = await requireRole("viewer");
  return loadSenderIdentity(workspaceId);
}

const identitySchema = z.object({
  name: z.string().trim().min(2, "Enter the name emails come from — a person or company.").max(120),
  address: z.string().trim().min(8, "Enter a postal address (street, city, country).").max(300),
});

/** Sender name + postal address printed in every email's footer (owner/admin). Campaign launch is blocked without them. */
export async function saveSenderIdentityAction(input: unknown): Promise<ActionResult<SenderIdentity>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    const v = identitySchema.parse(input);
    await saveSenderIdentity(workspaceId, v);
    await logActivity({ workspaceId, actorUserId: userId, type: "workspace.sender_identity_updated", entityType: "workspace", entityId: workspaceId, summary: "Updated the sender identity shown in email footers" });
    revalidatePath("/dashboard/settings/positioning");
    return { name: v.name, address: v.address };
  });
}

export async function retrySendAction(sendId: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await retryFailedSend(workspaceId, userId, idSchema.parse(sendId));
    revalidatePath("/dashboard/campaigns");
    return { ok: true as const };
  });
}

export async function skipSendAction(sendId: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await skipFailedSend(workspaceId, userId, idSchema.parse(sendId));
    revalidatePath("/dashboard/campaigns");
    return { ok: true as const };
  });
}
