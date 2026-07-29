import cron from "node-cron";

// A real always-on process holding the timer in memory — the thing a Vercel
// serverless function structurally cannot be, since it's frozen/killed
// between invocations. Run this with `npm run scheduler`, kept alive by pm2,
// a systemd service, or a Railway/Fly.io/VPS worker process — NOT deployed
// to Vercel itself. It just calls the same /api/cron/send-campaigns endpoint
// the Vercel Cron config (vercel.json) or any external pinger would.

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const SCHEDULE = process.env.SCHEDULER_CRON ?? "*/10 * * * *";

if (!CRON_SECRET) {
  console.error("CRON_SECRET is not set — required to call /api/cron/send-campaigns");
  process.exit(1);
}

async function runDispatch() {
  const startedAt = new Date().toISOString();
  try {
    const res = await fetch(`${APP_URL}/api/cron/send-campaigns`, {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const body = await res.json();
    console.log(`[${startedAt}] dispatch (${res.status}):`, JSON.stringify(body));
  } catch (err) {
    console.error(`[${startedAt}] dispatch failed:`, err instanceof Error ? err.message : err);
  }
}

console.log(`Scheduler started — hitting ${APP_URL}/api/cron/send-campaigns on "${SCHEDULE}"`);
cron.schedule(SCHEDULE, runDispatch);

// Fire once immediately on startup rather than waiting for the first tick.
runDispatch();
