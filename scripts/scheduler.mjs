import cron from "node-cron";

// Minute-cron alternative to `npm run worker` (Phase 5): ticks /api/jobs/tick once a minute. Each tick enqueues what is due
// (including emails) and runs the queued jobs. Prefer `npm run worker` (near-instant pickup); use this — or any external
// pinger — where a continuously-running loop isn't possible. The old /api/cron/send-campaigns endpoint is a deprecated alias.

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const JOBS_SCHEDULE = process.env.JOBS_TICK_CRON ?? "* * * * *";

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set — required to call /api/jobs/tick");
  process.exit(1);
}

// Background jobs (research, re-scoring): drain due jobs. Idempotent and safe to overlap with the in-app `after()` kick.
async function runJobsTick() {
  const startedAt = new Date().toISOString();
  try {
    const res = await fetch(`${APP_URL}/api/jobs/tick`, { method: "POST", headers: { Authorization: `Bearer ${CRON_SECRET}` } });
    const body = await res.json();
    if (body.claimed > 0 || !res.ok) console.log(`[${startedAt}] jobs tick (${res.status}):`, JSON.stringify(body));
  } catch (err) {
    console.error(`[${startedAt}] jobs tick failed:`, err instanceof Error ? err.message : err);
  }
}

console.log(`Scheduler started — ticking ${APP_URL}/api/jobs/tick on "${JOBS_SCHEDULE}"`);
cron.schedule(JOBS_SCHEDULE, runJobsTick);

// Fire once immediately on startup rather than waiting for the first tick.
runJobsTick();
