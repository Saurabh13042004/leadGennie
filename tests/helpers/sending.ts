import { afterEach, beforeEach } from "vitest";
import { sql } from "./test-db";
import { FakeMailProvider } from "@/lib/email/fake-provider";
import { setMailProvider } from "@/lib/email/provider";
import { setClock } from "@/lib/domain/sending/clock";
import { runTick } from "@/lib/jobs/worker";
import "@/lib/jobs/handlers"; // registers the campaign_send job + scheduler

/**
 * Installs a fresh FakeMailProvider for each test and neutralises the two REAL-TIME throttles that would make ordinary tests
 * slow or order-dependent (spacing between sends, per-domain hourly cap). Tests of those rules set them back explicitly.
 */
export function installFakeMail(): { mail: () => FakeMailProvider } {
  let mail: FakeMailProvider;
  beforeEach(() => {
    mail = new FakeMailProvider();
    setMailProvider(mail);
    process.env.SEND_SPACING_SECONDS = "0";
    process.env.SEND_DOMAIN_HOURLY_LIMIT = "100000";
  });
  afterEach(() => {
    setMailProvider(null);
    setClock(null);
    delete process.env.SEND_SPACING_SECONDS;
    delete process.env.SEND_DOMAIN_HOURLY_LIMIT;
  });
  return { mail: () => mail };
}

export type SendRun = { processed: number; sent: number; failed: number; blocked: number; canceled: number; pending: number; ticks: number };

/**
 * What the worker does, run inline: schedulers enqueue due emails, `campaign_send` jobs send them. Repeats until a tick finds
 * nothing to run. Returns how the sends that were due at the start ended up.
 */
export async function runSends(opts: { workspaceId?: number; maxTicks?: number; retryBackoff?: boolean } = {}): Promise<SendRun> {
  const scope = opts.workspaceId ?? null;
  const due = await sql`select cs.id from campaign_sends cs join campaigns c on c.id = cs.campaign_id where cs.channel = 'email' and cs.status = 'pending' and cs.scheduled_at <= now() and c.status = 'running' and (${scope}::bigint is null or cs.workspace_id = ${scope})`;
  const ids = due.map((r) => Number(r.id));
  let ticks = 0;
  for (; ticks < (opts.maxTicks ?? 12); ticks++) {
    if (opts.retryBackoff) await sql`update jobs set run_at = now() where status = 'queued'`; // skip real waiting between retries
    const t = await runTick({ budgetMs: 20_000, maxJobs: 500, batchSize: 25, workspaceId: opts.workspaceId, workerId: "test-worker" });
    if (t.claimed === 0) break;
  }
  const rows = ids.length ? await sql`select status, count(*)::int as n from campaign_sends where id = any(${ids}::bigint[]) group by status` : [];
  const by = Object.fromEntries(rows.map((r) => [String(r.status), Number(r.n)]));
  return { processed: ids.length, sent: by.sent ?? 0, failed: by.failed ?? 0, blocked: by.blocked ?? 0, canceled: by.canceled ?? 0, pending: by.pending ?? 0, ticks };
}
