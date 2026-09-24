"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { runAction, type ActionResult } from "@/lib/api/action";
import { addLeadsToDnc, deleteLeadsWithoutHistory } from "@/lib/db/leads-bulk";

const idsSchema = z.array(z.number().int().positive()).min(1, "Select at least one lead.").max(500, "Select at most 500 leads at a time.");

export type BulkDncResult = { selected: number; withEmail: number; added: number };
export type BulkDeleteResult = { deleted: number; keptBecauseContacted: number };

/** Suppress the selected leads' emails. They stay in the workspace but can no longer be enrolled or emailed. */
export async function bulkAddToDnc(leadIds: number[]): Promise<ActionResult<BulkDncResult>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const ids = idsSchema.parse(leadIds);
    const result = await addLeadsToDnc(workspaceId, userId, ids, "Added from Leads (bulk)");
    await logActivity({
      workspaceId, actorUserId: userId, type: "dnc.bulk_added", entityType: "lead", entityId: null,
      summary: `Added ${result.added} email${result.added === 1 ? "" : "s"} to Do Not Contact`,
      metadata: { ...result },
    });
    revalidatePath("/dashboard/leads");
    revalidatePath("/dashboard/do-not-contact");
    return result;
  });
}

/** Delete leads with no send history; contacted leads are kept (Do Not Contact is the right tool for them). */
export async function bulkDeleteLeads(leadIds: number[]): Promise<ActionResult<BulkDeleteResult>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    const ids = idsSchema.parse(leadIds);
    const { deleted, blocked } = await deleteLeadsWithoutHistory(workspaceId, ids);
    await logActivity({
      workspaceId, actorUserId: userId, type: "leads.bulk_deleted", entityType: "lead", entityId: null,
      summary: `Deleted ${deleted.length} lead${deleted.length === 1 ? "" : "s"}${blocked.length ? ` (${blocked.length} kept: already contacted)` : ""}`,
      metadata: { deleted: deleted.length, kept: blocked.length },
    });
    revalidatePath("/dashboard/leads");
    return { deleted: deleted.length, keptBecauseContacted: blocked.length };
  });
}
