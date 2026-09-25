import { after } from "next/server";
import { createLogger } from "@/lib/log";
import { runTick } from "./worker";
import "./handlers";

const log = createLogger({ scope: "jobs.kick" });

/**
 * Best-effort: run a short worker tick right after the current response (Next's `after()`), so a user who just
 * clicked "Research" sees progress without waiting for the scheduler. The scheduler tick
 * (`/api/jobs/tick`, called every minute by scripts/scheduler.mjs) is what guarantees jobs eventually run;
 * this only shortens the wait. Outside a request scope (tests, scripts) it is a no-op.
 */
export function kickWorker(): void {
  try {
    after(async () => {
      try {
        // Never sends email from a request: `campaign_send` jobs are left to the worker's own tick.
        await runTick({ budgetMs: 20_000, maxJobs: 10, excludeTypes: ["campaign_send"], skipSchedulers: true });
      } catch (err) {
        log.warn("kick.tick_failed", { err });
      }
    });
  } catch {
    // no request scope
  }
}
