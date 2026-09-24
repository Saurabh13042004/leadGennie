// Creates ONE demo workspace, flagged workspaces.is_demo = true, so demos,
// tests and E2E runs never mix with real customer data.
//
//   npm run db:seed -- --yes                      (password printed once if not supplied)
//   SEED_DEMO_PASSWORD=... npm run db:seed -- --yes
//   node --env-file=.env.local scripts/seed.mjs --yes --env=DATABASE_URL_TEST
//
// Idempotent. Logic lives in scripts/lib/seed-demo.mjs (unit-tested).
import { neon } from "@neondatabase/serverless";
import { seedDemo } from "./lib/seed-demo.mjs";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
const envName = envArg ? envArg.slice("--env=".length) : "DATABASE_URL";
const url = process.env[envName];

if (!url) {
  console.error(`${envName} is not set`);
  process.exit(1);
}
if (!args.includes("--yes")) {
  console.error(`Refusing to seed ${envName} without --yes (this writes a demo user + workspace).`);
  process.exit(1);
}

const { generatedPassword } = await seedDemo(neon(url), {
  password: process.env.SEED_DEMO_PASSWORD || undefined,
  log: (m) => console.log(m),
});
if (generatedPassword) console.log(`Password (shown once): ${generatedPassword}`);
