"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { enqueueDueSends } from "@/lib/domain/sending/scheduler";
import { getSendingHealth, type SendingHealth } from "@/lib/domain/sending/health";
import "@/lib/jobs/handlers";

/**
 * "Send due messages now": queues every email that is due for this workspace and returns. It never sends from the request —
 * the sending worker picks the jobs up within seconds (the worker ticks continuously; see docs/deployment.md).
 * Admin-gated because it is an explicit "go now" on top of the normal schedule.
 */
export async function runDueSendsNow(): Promise<{ queued: number; poisoned: number; health: SendingHealth }> {
  const { workspaceId, userId } = await requireRole("admin");
  const r = await enqueueDueSends({ workspaceId });
  await logActivity({
    workspaceId, actorUserId: userId, type: "campaign.manual_dispatch", entityType: "campaign", entityId: null,
    summary: `Queued ${r.enqueued} due email(s) for the sending worker${r.poisoned ? ` (${r.poisoned} marked failed after repeated errors)` : ""}`,
  });
  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/brief");
  return { queued: r.enqueued, poisoned: r.poisoned, health: await getSendingHealth(workspaceId) };
}
