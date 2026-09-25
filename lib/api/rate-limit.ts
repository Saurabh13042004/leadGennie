import { createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { AppError } from "./errors";

/**
 * Fixed-window rate limiting backed by Postgres (no Redis in the stack). One upsert per check; the count is
 * incremented atomically, so concurrent requests cannot both slip under the limit. Old windows are swept
 * opportunistically so the table stays tiny.
 *
 * Buckets identify WHO is being limited (a session, an address) — never tenant data.
 */
export type RateLimit = { limit: number; windowSeconds: number };

export async function checkRateLimit(bucket: string, { limit, windowSeconds }: RateLimit, now: Date = new Date()): Promise<void> {
  const windowStart = new Date(Math.floor(now.getTime() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const rows = await sql`
    insert into api_rate_limits (bucket, window_start, count) values (${bucket}, ${windowStart.toISOString()}, 1)
    on conflict (bucket, window_start) do update set count = api_rate_limits.count + 1
    returning count
  `;
  const count = Number(rows[0].count);
  if (Math.random() < 0.02) {
    // Sweep expired windows now and then; harmless if it races or fails.
    try {
      await sql`delete from api_rate_limits where window_start < ${new Date(now.getTime() - 3_600_000).toISOString()}`;
    } catch {
      /* best effort */
    }
  }
  if (count > limit) {
    const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 1000));
    throw new AppError("RATE_LIMITED", "Too many requests — slow down and try again shortly.", undefined, { retryAfterSeconds: retryAfter });
  }
}

/** Short, non-reversible bucket component for a client address (so raw IPs are never stored). */
export function addressBucket(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(fwd).digest("hex").slice(0, 16);
}
