import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { enqueue } from "@/lib/jobs/queue";
import { kickWorker } from "@/lib/jobs/kick";
import { createAgentRun } from "@/lib/domain/agent-runs/service";
import type { Actor } from "./drafts";
import type { Tone } from "./types";

/** Bulk generation is capped per request: it bounds LLM spend and keeps the queue fair. */
export const MAX_BULK_DRAFTS = 50;

export type DraftBatchResult = {
  agentRunId: number;
  enqueued: { leadId: number; jobId: number }[];
  skipped: { leadId: number; reason: "not_found" | "already_running" }[];
};

/**
 * Queues one `personalization` job per lead under a single batch run. A lead that already has a draft job
 * queued or running is skipped (a double click never spends twice); regenerating a lead that already HAS a
 * draft is deliberate and allowed — the old draft is kept as history.
 */
export async function enqueueDraftGeneration(actor: Actor, leadIds: number[], opts: { tone?: Tone; includeNews?: boolean } = {}): Promise<DraftBatchResult> {
  const ids = Array.from(new Set(leadIds.filter((n) => Number.isInteger(n) && n > 0)));
  if (ids.length === 0) throw new AppError("VALIDATION_ERROR", "Select at least one lead.");
  if (ids.length > MAX_BULK_DRAFTS) {
    throw new AppError("VALIDATION_ERROR", `You can generate up to ${MAX_BULK_DRAFTS} emails at a time. Select fewer and run again.`);
  }
  const [found, pending] = await Promise.all([
    sql`select id from leads where workspace_id = ${actor.workspaceId} and id = any(${ids}::bigint[])`,
    sql`
      select (payload->>'leadId')::bigint as lead_id from jobs
      where workspace_id = ${actor.workspaceId} and type = 'personalization' and status in ('queued', 'running')
        and (payload->>'leadId')::bigint = any(${ids}::bigint[])`,
  ]);
  const exists = new Set(found.map((r) => Number(r.id)));
  const busy = new Set(pending.map((r) => Number(r.lead_id)));

  const skipped: DraftBatchResult["skipped"] = [];
  const todo: number[] = [];
  for (const id of ids) {
    if (!exists.has(id)) skipped.push({ leadId: id, reason: "not_found" });
    else if (busy.has(id)) skipped.push({ leadId: id, reason: "already_running" });
    else todo.push(id);
  }

  const agentRunId = await createAgentRun({
    workspaceId: actor.workspaceId, userId: actor.userId, type: "personalization_batch",
    input: { leadIds: ids, tone: opts.tone ?? null, includeNews: opts.includeNews ?? false }, status: todo.length === 0 ? "completed" : "running",
  });
  const enqueued: DraftBatchResult["enqueued"] = [];
  for (const leadId of todo) {
    const { job } = await enqueue({
      workspaceId: actor.workspaceId, userId: actor.userId, type: "personalization",
      payload: { leadId, tone: opts.tone ?? null, includeNews: opts.includeNews ?? false },
      idempotencyKey: `personalization:${agentRunId}:${leadId}`, agentRunId,
    });
    enqueued.push({ leadId, jobId: job.id });
  }
  if (enqueued.length > 0) {
    await logActivity({
      workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "draft.batch_requested", entityType: "agent_run", entityId: agentRunId,
      summary: `Requested email drafts for ${enqueued.length} lead(s)`,
    });
    kickWorker();
  }
  return { agentRunId, enqueued, skipped };
}

export async function setWorkspaceTone(workspaceId: number, tone: Tone): Promise<void> {
  await sql`update workspaces set tone = ${tone} where id = ${workspaceId}`;
}

export async function getWorkspaceTone(workspaceId: number): Promise<Tone> {
  const rows = await sql`select tone from workspaces where id = ${workspaceId}`;
  const t = rows[0]?.tone;
  return t === "friendly" || t === "formal" || t === "direct" ? t : "concise";
}
