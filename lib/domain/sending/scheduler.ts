import { sql } from "@/lib/db/client";
import { now as clockNow } from "./clock";

/** After this many jobs for one send have died without sending, stop re-queuing it and surface it as failed (a poison send must not loop). */
export const MAX_JOB_GENERATIONS = 3;
const BATCH = 500;
const SEND_JOB_ATTEMPTS = 8;

/**
 * The scheduler half of WP5.2: finds emails that are DUE (pending, scheduled_at passed, campaign running) and have no live job,
 * and enqueues one `campaign_send` job for each. This is the only thing that creates send jobs.
 *
 *  · Idempotency key `send:{campaignSendId}:{generation}` — running this scheduler concurrently (two workers, a manual nudge, a
 *    double tick) creates each job once. `generation` counts earlier jobs for the same send, so when a job ends WITHOUT sending
 *    (the campaign was paused, then resumed) the send gets a fresh job instead of being blocked by the old key forever.
 *  · Legacy `campaign_sends` (pre-rendered by the old wizard) flow through here too, so the old dispatcher's backlog drains
 *    through the same safe path — there is no second sender to retire later.
 */
export async function enqueueDueSends(opts: { workspaceId?: number; now?: Date; limit?: number } = {}): Promise<{ enqueued: number; poisoned: number }> {
  const at = (opts.now ?? clockNow()).toISOString();
  const rows = await sql.query(
    `/* workspace-scope-ok: the scheduler is cross-tenant by design; every job it creates carries its own workspace_id */
     select cs.id, cs.workspace_id,
            (select count(*)::int from jobs j where j.type = 'campaign_send' and j.workspace_id = cs.workspace_id and j.payload ->> 'campaignSendId' = cs.id::text) as prior_jobs
     from campaign_sends cs
     join campaigns c on c.id = cs.campaign_id and c.workspace_id = cs.workspace_id
     where cs.status = 'pending' and cs.channel = 'email' and cs.scheduled_at <= $1::timestamptz and c.status = 'running'
       and ($2::bigint is null or cs.workspace_id = $2::bigint)
       and not exists (
         select 1 from jobs j where j.type = 'campaign_send' and j.workspace_id = cs.workspace_id
           and j.payload ->> 'campaignSendId' = cs.id::text and j.status in ('queued', 'running'))
     order by cs.scheduled_at, cs.id
     limit $3`,
    [at, opts.workspaceId ?? null, opts.limit ?? BATCH],
  );
  if (rows.length === 0) return { enqueued: 0, poisoned: 0 };

  const poison = rows.filter((r) => Number(r.prior_jobs) >= MAX_JOB_GENERATIONS);
  const ok = rows.filter((r) => Number(r.prior_jobs) < MAX_JOB_GENERATIONS);
  if (poison.length > 0) {
    await sql.query(
      `update campaign_sends cs set status = 'failed', error_message = 'Sending failed repeatedly — check the error log, then retry or skip'
       from unnest($1::bigint[], $2::bigint[]) as x(ws, id)
       where cs.id = x.id and cs.workspace_id = x.ws and cs.status = 'pending'`,
      [poison.map((r) => Number(r.workspace_id)), poison.map((r) => Number(r.id))],
    );
  }
  if (ok.length > 0) {
    await sql.query(
      `insert into jobs (workspace_id, type, payload, idempotency_key, run_at, max_attempts)
       select x.ws, 'campaign_send', jsonb_build_object('campaignSendId', x.id), 'send:' || x.id || ':' || x.gen, now(), $4::int
       from unnest($1::bigint[], $2::bigint[], $3::int[]) as x(ws, id, gen)
       on conflict (workspace_id, type, idempotency_key) where idempotency_key is not null do nothing`,
      [ok.map((r) => Number(r.workspace_id)), ok.map((r) => Number(r.id)), ok.map((r) => Number(r.prior_jobs) + 1), SEND_JOB_ATTEMPTS],
    );
  }
  return { enqueued: ok.length, poisoned: poison.length };
}
