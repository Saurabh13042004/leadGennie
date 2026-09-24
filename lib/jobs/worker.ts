import { createLogger } from "@/lib/log";
import { claimJobs, completeJob, failJob, rescheduleJob } from "./queue";
import { getJobHandler, jobSettledHooks } from "./registry";
import { JobError, type JobRow } from "./types";

export type TickResult = { claimed: number; done: number; waiting: number; retried: number; dead: number; lost: number };

export type TickOptions = {
  /** Stop claiming once this much wall-clock time has passed (serverless-friendly). */
  budgetMs?: number;
  maxJobs?: number;
  batchSize?: number;
  leaseSeconds?: number;
  workerId?: string;
  types?: string[];
};

const log = createLogger({ scope: "jobs" });

/**
 * Drains due jobs within a time budget. Safe to run from several places at once (cron tick, `after()` kick,
 * an always-on worker): claiming is atomic and every state change re-checks that this worker still owns the job.
 */
export async function runTick(opts: TickOptions = {}): Promise<TickResult> {
  const workerId = opts.workerId ?? `worker-${crypto.randomUUID().slice(0, 8)}`;
  const deadline = Date.now() + (opts.budgetMs ?? 25_000);
  const maxJobs = opts.maxJobs ?? 25;
  const batchSize = opts.batchSize ?? 5;
  const result: TickResult = { claimed: 0, done: 0, waiting: 0, retried: 0, dead: 0, lost: 0 };

  while (result.claimed < maxJobs && Date.now() < deadline) {
    const batch = await claimJobs(workerId, Math.min(batchSize, maxJobs - result.claimed), opts.leaseSeconds ?? 300, opts.types);
    if (batch.length === 0) break;
    result.claimed += batch.length;
    await Promise.all(batch.map((job) => runOne(job, workerId, result)));
  }
  return result;
}

async function runOne(job: JobRow, workerId: string, tally: TickResult): Promise<void> {
  const jobLog = createLogger({ scope: "jobs", job_id: job.id, job_type: job.type, workspace_id: job.workspaceId });
  const started = Date.now();
  const handler = getJobHandler(job.type);
  if (!handler) {
    // A job type nobody handles will never succeed: dead-letter it visibly instead of spinning.
    const r = await failJob(job, workerId, `No handler registered for job type "${job.type}"`, { retryable: false });
    tally[r === "lost" ? "lost" : "dead"]++;
    jobLog.error("job.no_handler");
    return;
  }
  if (job.attempts >= job.maxAttempts) {
    // Lease expired too many times (worker crashed on it repeatedly).
    const r = await failJob(job, workerId, "Job exceeded its maximum attempts (worker repeatedly lost its lease)", { retryable: false });
    tally[r === "lost" ? "lost" : "dead"]++;
    return;
  }

  try {
    const outcome = await handler({ job, workspaceId: job.workspaceId, userId: job.userId, log: jobLog });
    if (outcome.kind === "done") {
      if (await completeJob(job, workerId, outcome.result ?? {})) {
        tally.done++;
        await settled(job, jobLog);
      } else tally.lost++;
    } else {
      (await rescheduleJob(job, workerId, outcome.afterSeconds, outcome.state)) ? tally.waiting++ : tally.lost++;
    }
    jobLog.info("job.ran", { outcome: outcome.kind, duration_ms: Date.now() - started });
  } catch (err) {
    const retryable = err instanceof JobError ? err.opts.retryable : true;
    const message = err instanceof Error ? err.message : String(err);
    if (!(err instanceof JobError)) jobLog.error("job.unhandled_error", { err });
    const r = await failJob(job, workerId, message, {
      retryable,
      retryAfterSeconds: err instanceof JobError ? err.opts.retryAfterSeconds : undefined,
    });
    if (r === "retry") tally.retried++;
    else if (r === "dead") {
      tally.dead++;
      await settled(job, jobLog);
    } else tally.lost++;
    jobLog.warn("job.failed", { outcome: r, error: message, duration_ms: Date.now() - started });
  }
}

/** Hooks must never break the worker: a failure here is logged, the job outcome is already recorded. */
async function settled(job: JobRow, jobLog: ReturnType<typeof createLogger>): Promise<void> {
  for (const hook of jobSettledHooks()) {
    try {
      await hook(job);
    } catch (err) {
      jobLog.warn("job.settled_hook_failed", { err });
    }
  }
}

export { log as jobsLog };
