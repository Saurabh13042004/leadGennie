import { timingSafeEqual } from "node:crypto";
import { AppError, ok, withApi } from "@/lib/api";
import { runTick } from "@/lib/jobs/worker";
import "@/lib/jobs/handlers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function secretMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * DEPRECATED alias, kept for one release so existing pingers (an external cron, an old scheduler.mjs) keep working.
 * It no longer sends anything itself: it runs the same worker tick as POST /api/jobs/tick — schedulers enqueue what's
 * due and `campaign_send` jobs send it. Point pingers at /api/jobs/tick.
 */
export const GET = withApi(async (request, _ctx, { log }) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new AppError("NOT_CONFIGURED", "CRON_SECRET is not configured.");
  if (!secretMatches(request.headers.get("authorization"), cronSecret)) throw new AppError("UNAUTHENTICATED", "Unauthorized");
  const tally = await runTick({ budgetMs: 45_000, maxJobs: 50 });
  log.info("cron.send_campaigns_alias", { ...tally });
  return ok({ deprecated: "use POST /api/jobs/tick", ...tally });
});
