// Usage:
//   node --env-file=.env.local scripts/migrate.mjs                 apply pending migrations to $DATABASE_URL
//   node --env-file=.env.local scripts/migrate.mjs --status        show applied/pending, change nothing
//   node --env-file=.env.local scripts/migrate.mjs --env=DATABASE_URL_TEST
//
// Migrations: db/migrations/NNNN_name.sql, forward-only, checksummed.
// See scripts/lib/migrator.mjs.
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getStatus, loadMigrations, migrate, neonDriver } from "./lib/migrator.mjs";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
const envName = envArg ? envArg.slice("--env=".length) : "DATABASE_URL";
const statusOnly = args.includes("--status");

const url = process.env[envName];
if (!url) {
  console.error(`${envName} is not set`);
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), "../db/migrations");
const migrations = loadMigrations(dir);
const driver = neonDriver(neon(url));

try {
  if (statusOnly) {
    const status = await getStatus(driver, migrations);
    for (const m of migrations) {
      const applied = status.applied.find((r) => r.version === m.version);
      const bad = status.mismatched.some((x) => x.migration.version === m.version);
      console.log(`${bad ? "MODIFIED" : applied ? "applied " : "pending "}  ${m.file}`);
    }
    for (const r of status.unknown) console.log(`UNKNOWN   ${r.version}_${r.name} (in DB, not in repo)`);
    process.exit(status.mismatched.length || status.unknown.length ? 1 : 0);
  }

  const { appliedNow } = await migrate(driver, migrations, { log: (m) => console.log(m) });
  console.log(appliedNow.length ? `Applied ${appliedNow.length} migration(s).` : "Database is up to date.");
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
