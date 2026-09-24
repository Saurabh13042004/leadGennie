import { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getStatus, loadMigrations, migrate, pgliteDriver } from "../../scripts/lib/migrator.mjs";

const dir = join(process.cwd(), "db/migrations");

async function freshDb() {
  const db = new PGlite();
  return { db, driver: pgliteDriver(db) };
}

describe("migrations", () => {
  it("apply cleanly on an EMPTY database, in order", async () => {
    const { driver } = await freshDb();
    const migrations = loadMigrations(dir);
    const { appliedNow } = await migrate(driver, migrations);
    expect(appliedNow).toEqual(migrations.map((m) => m.file));
    expect(appliedNow[0]).toBe("0001_baseline.sql");

    const status = await getStatus(driver, migrations);
    expect(status.pending).toHaveLength(0);
    expect(status.mismatched).toHaveLength(0);
  });

  it("re-running is a no-op", async () => {
    const { driver } = await freshDb();
    const migrations = loadMigrations(dir);
    await migrate(driver, migrations);
    const second = await migrate(driver, migrations);
    expect(second.appliedNow).toEqual([]);
  });

  it("refuses to run if an applied migration was edited", async () => {
    const { driver } = await freshDb();
    const migrations = loadMigrations(dir);
    await migrate(driver, migrations);
    const tampered = migrations.map((m, i) => (i === 0 ? { ...m, checksum: "deadbeef" } : m));
    await expect(migrate(driver, tampered)).rejects.toThrow(/modified after being applied/);
  });

  it("refuses to run if the DB has migrations this checkout lacks", async () => {
    const { driver } = await freshDb();
    const migrations = loadMigrations(dir);
    await migrate(driver, migrations);
    await expect(migrate(driver, migrations.slice(0, -1))).rejects.toThrow(/does not contain/);
  });

  it("rolls back a failing migration completely", async () => {
    const { db, driver } = await freshDb();
    const good = { version: "0001", name: "ok", file: "0001_ok.sql", sql: "create table a (id int);", checksum: "1" };
    const bad = {
      version: "0002",
      name: "boom",
      file: "0002_boom.sql",
      sql: "create table b (id int); insert into nope values (1);",
      checksum: "2",
    };
    await expect(migrate(driver, [good, bad])).rejects.toThrow();
    const tables = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname='public' order by 1",
    );
    expect(tables.rows.map((r) => r.tablename)).toEqual(["a", "schema_migrations"]); // no "b"
    const status = await getStatus(driver, [good, bad]);
    expect(status.pending.map((m) => m.version)).toEqual(["0002"]);
  });

  it("upgrade path: a legacy plaintext API token is hashed in place and erased", async () => {
    const { db, driver } = await freshDb();
    const all = loadMigrations(dir);
    const beforeHash = all.filter((m) => m.version < "0004");
    await migrate(driver, beforeHash);

    await db.exec(`
      insert into users (name, email, password_hash) values ('U', 'u@example.com', 'x');
      insert into workspaces (name, slug, created_by_user_id) values ('W', 'w', 1);
      insert into api_tokens (workspace_id, owner_email, token) values (1, 'u@example.com', 'abcdef0123456789');
    `);

    await migrate(driver, all);
    const { rows } = await db.query<{ token: string | null; token_hash: string; token_prefix: string }>(
      "select token, token_hash, token_prefix from api_tokens",
    );
    const { createHash } = await import("node:crypto");
    expect(rows[0].token).toBeNull();
    expect(rows[0].token_prefix).toBe("abcdef01");
    expect(rows[0].token_hash).toBe(createHash("sha256").update("abcdef0123456789").digest("hex"));
  });

  it("0002 fails loudly (rolls back) if a row has no workspace to be assigned to", async () => {
    const { db, driver } = await freshDb();
    const all = loadMigrations(dir);
    await migrate(driver, all.slice(0, 1));
    await db.exec(`insert into leads (owner_email, full_name) values ('ghost@example.com', 'Orphan')`);
    await expect(migrate(driver, all)).rejects.toThrow();
    const status = await getStatus(driver, all);
    expect(status.pending[0].version).toBe("0002");
  });
});
