// Create companies from leads.company (and corporate email domains) and set leads.company_id.
//
//   node --env-file=.env.local scripts/backfill-companies.mjs --yes
//   node --env-file=.env.local scripts/backfill-companies.mjs --yes --env=DATABASE_URL_TEST
//
// Batched, idempotent, resumable: run it as often as you like — a second run changes nothing.
import { neon } from "@neondatabase/serverless";
import { neonDriver } from "./lib/migrator.mjs";
import { backfillCompanies } from "./lib/backfill.mjs";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
const envName = envArg ? envArg.slice("--env=".length) : "DATABASE_URL";
const url = process.env[envName];

if (!url) {
  console.error(`${envName} is not set`);
  process.exit(1);
}
if (!args.includes("--yes")) {
  console.error(`Refusing to write to ${envName} without --yes. Run migrations first (npm run db:migrate).`);
  process.exit(1);
}

try {
  const result = await backfillCompanies(neonDriver(neon(url)), { log: (m) => console.log(m) });
  console.log("Done:", JSON.stringify(result));
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
