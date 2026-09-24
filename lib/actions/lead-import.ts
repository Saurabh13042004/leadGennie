"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { runAction, type ActionResult } from "@/lib/api/action";
import { leadImportService, type ChunkResult, type ImportJobView } from "@/lib/domain/leads/import/service";
import { chunkSchema, emailListSchema, jobIdSchema, startImportSchema } from "@/lib/domain/leads/import/schemas";
import type { ReportEntry } from "@/lib/db/lead-import";

/**
 * Import server actions (WP1.2). Each one: authenticate → validate → call the
 * import service → return the envelope. They carry no logic of their own.
 *
 *   startImport → importLeadsChunk × N → finishImport
 *
 * Deviation from the phase spec's signature: options are supplied once, to
 * startImport, and stored on the job — a chunk cannot change them mid-import.
 */

export async function startImport(meta: unknown): Promise<ActionResult<ImportJobView>> {
  return runAction(async () => {
    const ctx = await requireRole("member");
    return leadImportService.start(ctx, startImportSchema.parse(meta));
  });
}

export async function importLeadsChunk(importJobId: number, chunk: unknown): Promise<ActionResult<ChunkResult>> {
  return runAction(async () => {
    const ctx = await requireRole("member");
    return leadImportService.importChunk(ctx, jobIdSchema.parse(importJobId), chunkSchema.parse(chunk));
  });
}

export async function finishImport(importJobId: number): Promise<ActionResult<ImportJobView>> {
  return runAction(async () => {
    const ctx = await requireRole("member");
    const job = await leadImportService.finish(ctx, jobIdSchema.parse(importJobId));
    await logActivity({
      workspaceId: ctx.workspaceId,
      actorUserId: ctx.userId,
      type: "leads.imported",
      entityType: "import_job",
      entityId: job.id,
      summary: `Imported ${job.created} new leads${job.updated ? `, updated ${job.updated}` : ""} from ${job.fileName ?? "a file"}`,
      metadata: { created: job.created, updated: job.updated, duplicate: job.duplicate, skipped: job.skipped, failed: job.failed, status: job.status },
    });
    revalidatePath("/dashboard/leads");
    revalidatePath("/dashboard");
    return job;
  });
}

/** Which of these emails already exist in the workspace / are on Do Not Contact — for the pre-commit dedupe preview. */
export async function lookupExistingLeads(emails: unknown): Promise<ActionResult<{ existing: string[]; blocked: string[] }>> {
  return runAction(async () => {
    const ctx = await requireRole("member");
    return leadImportService.lookupExisting(ctx, emailListSchema.parse(emails));
  });
}

export async function getImportReport(importJobId: number): Promise<ActionResult<{ job: ImportJobView; entries: ReportEntry[] }>> {
  return runAction(async () => {
    const ctx = await requireRole("viewer");
    return leadImportService.report(ctx, jobIdSchema.parse(importJobId));
  });
}
