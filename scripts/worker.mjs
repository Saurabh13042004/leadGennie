// The always-on sending/worker loop (Phase 5).
//
// It does not contain job logic: it keeps calling POST /api/jobs/tick, and each tick (a) runs the schedulers that enqueue
// due work — e.g. "these emails are due" — and (b) runs queued jobs within a time budget. Job state lives in Postgres
// (leases, backoff, idempotency keys), so this process can be killed and restarted, or run several times, at any moment
// without losing or duplicating a send. Run it wherever an always-on process is allowed (pm2, systemd, Railway/Fly/Render):
//
//   npm run worker
//
// No always-on host? Point ANY pinger (a cron, GitHub Actions, cron-job.org) at POST /api/jobs/tick every minute instead.

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const POLL_MS = Math.max(1, Number(process.env.WORKER_POLL_SECONDS ?? 5)) * 1000;
const MAX_BACKOFF_MS = 30_000;

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set — required to call /api/jobs/tick");
  process.exit(1);
}

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { stopping = true; console.log(`${sig}: finishing the current tick, then exiting`); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
console.log(`Worker started — ticking ${APP_URL}/api/jobs/tick (idle poll ${POLL_MS / 1000}s)`);
while (!stopping) {
  const startedAt = new Date().toISOString();
  let busy = false;
  try {
    const res = await fetch(`${APP_URL}/api/jobs/tick`, { method: "POST", headers: { Authorization: `Bearer ${CRON_SECRET}` }, signal: AbortSignal.timeout(75_000) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(body)}`);
    failures = 0;
    busy = (body.claimed ?? 0) > 0;
    if (busy) console.log(`[${startedAt}] tick:`, JSON.stringify(body));
  } catch (err) {
    failures++;
    console.error(`[${startedAt}] tick failed (${failures}):`, err instanceof Error ? err.message : err);
  }
  if (stopping) break;
  // Work found → look again immediately. Idle → poll. Errors → back off (the app may be restarting).
  await sleep(failures > 0 ? Math.min(POLL_MS * 2 ** Math.min(failures, 5), MAX_BACKOFF_MS) : busy ? 200 : POLL_MS);
}
console.log("Worker stopped");
