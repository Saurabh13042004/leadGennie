"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { processEmailSends, processLinkedinSends } from "@/lib/campaigns/dispatch";
import { logActivity } from "@/lib/activity";

/**
 * Manual trigger for local/dev testing and on-demand "why hasn't this sent
 * yet" checks — runs the exact same dispatch logic as the scheduled cron,
 * scoped to the caller's own workspace only. Admin-gated since it causes
 * real emails to go out immediately rather than on the usual schedule.
 */
export async function runDueSendsNow() {
  const { workspaceId, userId } = await requireRole("admin");

  const email = await processEmailSends(workspaceId);
  const linkedin = await processLinkedinSends(workspaceId);

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "campaign.manual_dispatch",
    entityType: "campaign",
    entityId: null,
    summary: `Manually ran due sends: ${email.sent ?? 0} sent, ${email.failed ?? 0} failed, ${email.blocked ?? 0} blocked (email); ${linkedin.queued} queued, ${linkedin.blocked} blocked (LinkedIn)`,
  });

  revalidatePath("/dashboard/campaigns");
  revalidatePath("/dashboard/brief");
  return { email, linkedin };
}
