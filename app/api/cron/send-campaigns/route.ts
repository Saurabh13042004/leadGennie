import { timingSafeEqual } from "node:crypto";
import { AppError, ok, withApi } from "@/lib/api";
import { processEmailSends, processLinkedinSends } from "@/lib/campaigns/dispatch";

export const dynamic = "force-dynamic";

function secretMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const GET = withApi(async (request, _ctx, { log }) => {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) throw new AppError("NOT_CONFIGURED", "CRON_SECRET is not configured.");
  if (!secretMatches(request.headers.get("authorization"), cronSecret)) {
    throw new AppError("UNAUTHENTICATED", "Unauthorized");
  }

  const email = await processEmailSends();
  const linkedin = await processLinkedinSends();
  log.info("cron.dispatch", { email, linkedin });

  return ok({ email, linkedin });
});
