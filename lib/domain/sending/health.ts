import { sql } from "@/lib/db/client";
import { now as clockNow } from "./clock";

export type SendingHealth = {
  /** Emails due to go out right now that nobody has picked up. */
  dueNow: number;
  /** When the worker last finished (or started) any job, anywhere. Null = never. */
  lastWorkerActivityAt: string | null;
  /** Due emails have been waiting > 3 minutes and no job has run in that time: the sending worker is probably not running. */
  workerStalled: boolean;
};

const STALL_MS = 3 * 60_000;

export async function getSendingHealth(workspaceId: number): Promise<SendingHealth> {
  const at = clockNow();
  const [due, last] = await Promise.all([
    sql`select count(*)::int as n, min(cs.scheduled_at) as oldest from campaign_sends cs join campaigns c on c.id = cs.campaign_id and c.workspace_id = cs.workspace_id
        where cs.workspace_id = ${workspaceId} and cs.status = 'pending' and cs.channel = 'email' and cs.scheduled_at <= ${at.toISOString()}::timestamptz and c.status = 'running'`,
    // workspace-scope-ok: only a timestamp of "has ANY worker run recently" — the worker is shared, so its heartbeat is too.
    sql`/* workspace-scope-ok: worker heartbeat is shared across tenants; no tenant data is read */ select max(coalesce(finished_at, started_at)) as at from jobs`,
  ]);
  const dueNow = Number(due[0].n);
  const lastAt = last[0]?.at ? new Date(String(last[0].at)) : null;
  const oldest = due[0].oldest ? new Date(String(due[0].oldest)) : null;
  const stalled = dueNow > 0 && oldest !== null && at.getTime() - oldest.getTime() > STALL_MS && (lastAt === null || at.getTime() - lastAt.getTime() > STALL_MS);
  return { dueNow, lastWorkerActivityAt: lastAt ? lastAt.toISOString() : null, workerStalled: stalled };
}
