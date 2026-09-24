import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { splitStatements } from "./sql-split.mjs";

/**
 * Versioned, forward-only migrations.
 *
 * Files live in db/migrations/NNNN_name.sql and are applied in filename order.
 * Each file runs as ONE transaction together with its schema_migrations row,
 * so a failed migration leaves nothing half-applied. An applied file must
 * never be edited — its checksum is verified on every run.
 *
 * The runner is driver-agnostic. A driver is:
 *   query(text, params?)            -> Promise<rows[]>
 *   transaction(queries)            -> Promise<void>   queries: {text, params?}[]
 * (see neonDriver / pgliteDriver below).
 */

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;

export function checksum(text) {
  return createHash("sha256").update(text).digest("hex");
}

export function loadMigrations(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const seen = new Set();
  return files.map((file) => {
    const m = FILE_RE.exec(file);
    if (!m) {
      throw new Error(`Bad migration filename "${file}" — expected NNNN_snake_case_name.sql`);
    }
    const [, version, name] = m;
    if (seen.has(version)) throw new Error(`Duplicate migration version ${version}`);
    seen.add(version);
    const sqlText = readFileSync(join(dir, file), "utf-8");
    return { version, name, file, sql: sqlText, checksum: checksum(sqlText) };
  });
}

const BOOTSTRAP = `
  create table if not exists schema_migrations (
    version text primary key,
    name text not null,
    checksum text not null,
    applied_at timestamptz not null default now()
  )
`;

export async function getStatus(driver, migrations) {
  await driver.query(BOOTSTRAP);
  const applied = await driver.query(
    "select version, name, checksum, applied_at from schema_migrations order by version",
  );
  const appliedByVersion = new Map(applied.map((r) => [r.version, r]));

  const mismatched = [];
  const pending = [];
  for (const m of migrations) {
    const row = appliedByVersion.get(m.version);
    if (!row) pending.push(m);
    else if (row.checksum !== m.checksum) mismatched.push({ migration: m, appliedChecksum: row.checksum });
  }
  const unknown = applied.filter((r) => !migrations.some((m) => m.version === r.version));
  return { applied, pending, mismatched, unknown };
}

/**
 * Apply every pending migration in order. Throws (before running anything) if
 * an already-applied migration was edited, or the DB has versions this
 * checkout doesn't know about (someone deployed a newer branch).
 */
export async function migrate(driver, migrations, { log = () => {} } = {}) {
  const status = await getStatus(driver, migrations);

  if (status.mismatched.length > 0) {
    const names = status.mismatched.map((x) => x.migration.file).join(", ");
    throw new Error(
      `Applied migration(s) were modified after being applied: ${names}. ` +
        `Never edit an applied migration — add a new numbered one instead.`,
    );
  }
  if (status.unknown.length > 0) {
    const names = status.unknown.map((r) => `${r.version}_${r.name}`).join(", ");
    throw new Error(`Database has migrations this checkout does not contain: ${names}`);
  }

  for (const m of status.pending) {
    const statements = splitStatements(m.sql);
    log(`applying ${m.file} (${statements.length} statements)`);
    await driver.transaction([
      ...statements.map((text) => ({ text })),
      {
        text: "insert into schema_migrations (version, name, checksum) values ($1, $2, $3)",
        params: [m.version, m.name, m.checksum],
      },
    ]);
  }
  return { appliedNow: status.pending.map((m) => m.file) };
}

export function neonDriver(sql) {
  return {
    query: (text, params) => sql.query(text, params ?? []),
    transaction: async (queries) => {
      await sql.transaction(queries.map((q) => sql.query(q.text, q.params ?? [])));
    },
  };
}

export function pgliteDriver(db) {
  return {
    query: async (text, params) => (await db.query(text, params ?? [])).rows,
    transaction: async (queries) => {
      await db.transaction(async (tx) => {
        for (const q of queries) await tx.query(q.text, q.params ?? []);
      });
    },
  };
}
