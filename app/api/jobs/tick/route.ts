import { timingSafeEqual } from "node:crypto";
import { AppError, ok, withApi } from "@/lib/api";
import { runTick } from "@/lib/jobs/worker";
import "@/lib/jobs/handlers";

export const dynamic = "force-dynamic";
// A tick drains due jobs within its own time budget; give the platform room to let it finish.
export const maxDuration = 60;

function secretMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Worker tick (called every minute by scripts/scheduler.mjs or any pinger). Cross-tenant by design; secret-protected. */
export const POST = withApi(async (request, _ctx, { log }) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new AppError("NOT_CONFIGURED", "CRON_SECRET is not configured.");
  if (!secretMatches(request.headers.get("authorization"), secret)) throw new AppError("UNAUTHENTICATED", "Unauthorized");
  const tally = await runTick({ budgetMs: 45_000, maxJobs: 50 });
  if (tally.claimed > 0) log.info("jobs.tick", { ...tally });
  return ok({ ...tally });
});
