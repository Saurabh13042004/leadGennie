import { createLogger } from "@/lib/log";

/**
 * Schedulers (WP5.2) are the recurring half of the job runtime: cheap, idempotent functions that look at the world and
 * ENQUEUE work ("these sends are due"). The worker runs them at the start of every tick, so a tick both finds and does
 * the work; several workers/ticks running them at once is harmless because each one only ever enqueues idempotently.
 */
export type Scheduler = (opts: { workspaceId?: number }) => Promise<Record<string, unknown>>;

const schedulers = new Map<string, Scheduler>();
const log = createLogger({ scope: "jobs.scheduler" });

export function registerScheduler(name: string, fn: Scheduler): void {
  schedulers.set(name, fn);
}

/** A failing scheduler is logged and skipped — it must never stop the tick from running the jobs already queued. */
export async function runSchedulers(opts: { workspaceId?: number } = {}): Promise<Record<string, Record<string, unknown>>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [name, fn] of schedulers) {
    try {
      out[name] = await fn(opts);
    } catch (err) {
      log.error("scheduler.failed", { scheduler: name, err });
      out[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return out;
}

export function clearSchedulers(): void {
  schedulers.clear();
}
