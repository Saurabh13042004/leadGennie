import { sql } from "@/lib/db/client";
import type { JobRow, JobStatus } from "./types";

/** Exponential backoff with jitter: 5s, 10s, 20s … capped at 15 minutes. */
export function backoffSeconds(failures: number, random: () => number = Math.random): number {
  const base = Math.min(5 * 2 ** Math.max(0, failures - 1), 900);
  return Math.round(base * (0.75 + random() * 0.5));
}

function toJob(r: Record<string, unknown>): JobRow {
  return {
    id: Number(r.id),
    workspaceId: Number(r.workspace_id),
    userId: r.user_id === null ? null : Number(r.user_id),
    type: String(r.type),
    payload: (r.payload ?? {}) as Record<string, unknown>,
    state: (r.state ?? {}) as Record<string, unknown>,
    status: r.status as JobStatus,
    idempotencyKey: (r.idempotency_key as string | null) ?? null,
    attempts: Number(r.attempts),
    maxAttempts: Number(r.max_attempts),
    agentRunId: r.agent_run_id === null || r.agent_run_id === undefined ? null : Number(r.agent_run_id),
  };
}

export type EnqueueInput = {
  workspaceId: number;
  userId: number | null;
  type: string;
  payload: Record<string, unknown>;
  /** Re-enqueueing the same (workspace, type, key) is a no-op that returns the existing job. */
  idempotencyKey?: string;
  runAt?: Date;
  maxAttempts?: number;
  agentRunId?: number | null;
};

export async function enqueue(input: EnqueueInput): Promise<{ job: JobRow; created: boolean }> {
  const runAt = input.runAt ?? new Date();
  const inserted = await sql`
    insert into jobs (workspace_id, user_id, type, payload, idempotency_key, run_at, max_attempts, agent_run_id)
    values (${input.workspaceId}, ${input.userId}, ${input.type}, ${JSON.stringify(input.payload)},
            ${input.idempotencyKey ?? null}, ${runAt.toISOString()}, ${input.maxAttempts ?? 5}, ${input.agentRunId ?? null})
    on conflict (workspace_id, type, idempotency_key) where idempotency_key is not null do nothing
    returning *
  `;
  if (inserted.length > 0) return { job: toJob(inserted[0]), created: true };
  const existing = await sql`
    select * from jobs
    where workspace_id = ${input.workspaceId} and type = ${input.type} and idempotency_key = ${input.idempotencyKey ?? null}
  `;
  return { job: toJob(existing[0]), created: false };
}

/**
 * Claims up to `limit` due jobs with ONE statement (`FOR UPDATE SKIP LOCKED`), so concurrent workers never take
 * the same job. A job whose lease expired (worker crashed mid-run) is claimable again and that counts as a failure
 * (attempts + 1) so a poison job can't crash workers forever.
 */
export async function claimJobs(workerId: string, limit: number, leaseSeconds: number, types?: string[]): Promise<JobRow[]> {
  const rows = await sql`
    /* workspace-scope-ok: the worker is cross-tenant by design; every job row carries its own workspace_id */
    update jobs
    set status = 'running',
        locked_by = ${workerId},
        locked_until = now() + (${leaseSeconds} || ' seconds')::interval,
        started_at = coalesce(started_at, now()),
        attempts = case when status = 'running' then attempts + 1 else attempts end
    where id in (
      select id from jobs
      where ((status = 'queued' and run_at <= now()) or (status = 'running' and locked_until < now()))
        and (${types ?? null}::text[] is null or type = any(${types ?? null}::text[]))
      order by run_at
      limit ${limit}
      for update skip locked
    )
    returning *
  `;
  return rows.map(toJob);
}

/** The next statements only apply while THIS worker still holds the job (a cancel or lease loss wins). */
export async function completeJob(job: JobRow, workerId: string, result: Record<string, unknown>): Promise<boolean> {
  const rows = await sql`
    update jobs set status = 'succeeded', result = ${JSON.stringify(result)}, finished_at = now(), locked_by = null, locked_until = null
    where id = ${job.id} and workspace_id = ${job.workspaceId} and status = 'running' and locked_by = ${workerId}
    returning id
  `;
  return rows.length > 0;
}

export async function rescheduleJob(job: JobRow, workerId: string, afterSeconds: number, state: Record<string, unknown>): Promise<boolean> {
  const rows = await sql`
    update jobs set status = 'queued', run_at = now() + (${afterSeconds} || ' seconds')::interval, state = ${JSON.stringify(state)},
                    locked_by = null, locked_until = null
    where id = ${job.id} and workspace_id = ${job.workspaceId} and status = 'running' and locked_by = ${workerId}
    returning id
  `;
  return rows.length > 0;
}

/** Records a failure: retry with backoff, or dead-letter when the error is permanent or attempts are exhausted. */
export async function failJob(
  job: JobRow,
  workerId: string,
  error: string,
  opts: { retryable: boolean; retryAfterSeconds?: number },
): Promise<"retry" | "dead" | "lost"> {
  const failures = job.attempts + 1;
  const dead = !opts.retryable || failures >= job.maxAttempts;
  const delay = opts.retryAfterSeconds ?? backoffSeconds(failures);
  const rows = dead
    ? await sql`
        update jobs set status = 'dead', attempts = ${failures}, error = ${error.slice(0, 2000)}, finished_at = now(), locked_by = null, locked_until = null
        where id = ${job.id} and workspace_id = ${job.workspaceId} and status = 'running' and locked_by = ${workerId} returning id`
    : await sql`
        update jobs set status = 'queued', attempts = ${failures}, error = ${error.slice(0, 2000)},
                        run_at = now() + (${delay} || ' seconds')::interval, locked_by = null, locked_until = null
        where id = ${job.id} and workspace_id = ${job.workspaceId} and status = 'running' and locked_by = ${workerId} returning id`;
  if (rows.length === 0) return "lost";
  return dead ? "dead" : "retry";
}

/** Cancel queued/running jobs of one agent run (or specific ids). A running handler notices at its next poll. */
export async function cancelJobs(workspaceId: number, where: { agentRunId?: number; ids?: number[] }): Promise<number> {
  const rows = await sql`
    update jobs set status = 'canceled', finished_at = now(), locked_by = null, locked_until = null
    where workspace_id = ${workspaceId} and status in ('queued', 'running')
      and (${where.agentRunId ?? null}::bigint is null or agent_run_id = ${where.agentRunId ?? null})
      and (${where.ids ?? null}::bigint[] is null or id = any(${where.ids ?? null}::bigint[]))
    returning id
  `;
  return rows.length;
}

export async function getJob(workspaceId: number, id: number): Promise<JobRow | null> {
  const rows = await sql`select * from jobs where id = ${id} and workspace_id = ${workspaceId}`;
  return rows.length ? toJob(rows[0]) : null;
}

/** Counts by status for one agent run — the source of truth for bulk-research progress. */
export async function jobCounts(workspaceId: number, agentRunId: number): Promise<Record<JobStatus, number>> {
  const rows = await sql`
    select status, count(*)::int as n from jobs where workspace_id = ${workspaceId} and agent_run_id = ${agentRunId} group by status
  `;
  const out: Record<JobStatus, number> = { queued: 0, running: 0, succeeded: 0, failed: 0, dead: 0, canceled: 0 };
  for (const r of rows) out[r.status as JobStatus] = Number(r.n);
  return out;
}
