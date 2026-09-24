import { PGlite, types } from "@electric-sql/pglite";
import { join } from "node:path";
import { loadMigrations, migrate, pgliteDriver } from "../../scripts/lib/migrator.mjs";
import { createTestSql } from "./pglite-sql";

/**
 * Hermetic per-test-file database: an in-process Postgres (PGlite) migrated
 * from EMPTY using the real db/migrations files. Nothing here can reach the
 * real Neon database — tests/setup.ts also blocks the Neon driver outright.
 */
let dbPromise: Promise<PGlite> | null = null;

export function getTestDb(): Promise<PGlite> {
  dbPromise ??= (async () => {
    const db = new PGlite({
      // Neon's HTTP driver returns bigint columns as strings; match it so tests
      // exercise the same value shapes the app sees in production.
      parsers: { [types.INT8]: (v: string) => v },
    });
    const migrations = loadMigrations(join(process.cwd(), "db/migrations"));
    await migrate(pgliteDriver(db), migrations);
    return db;
  })();
  return dbPromise;
}

export const sql = createTestSql(getTestDb);

/** Empty every table (keeps schema + schema_migrations). Call in beforeEach. */
export async function resetDb(): Promise<void> {
  const db = await getTestDb();
  const { rows } = await db.query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  const list = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.exec(`truncate table ${list} restart identity cascade`);
}
