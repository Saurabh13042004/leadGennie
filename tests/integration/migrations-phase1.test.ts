import { PGlite } from "@electric-sql/pglite";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadMigrations, migrate, pgliteDriver } from "../../scripts/lib/migrator.mjs";
import { backfillCompanies, backfillEmailStatus, backfillLeadNames } from "../../scripts/lib/backfill.mjs";

const dir = join(process.cwd(), "db/migrations");

/** Phase 1 migrations must be safe on a database that already holds real (pre-Phase-1) data. */
describe("Phase 1 migrations on a populated database", () => {
  it("apply over existing leads without touching them, then the backfills link everything", async () => {
    const db = new PGlite();
    const driver = pgliteDriver(db);
    const all = loadMigrations(dir);
    const before = all.filter((m: { version: string }) => Number(m.version) < 5);
    const phase1 = all.filter((m: { version: string }) => Number(m.version) >= 5);
    expect(phase1.map((m: { file: string }) => m.file)).toEqual([
      "0005_companies_and_lead_fields.sql",
      "0006_import_job_progress.sql",
      "0007_workspace_positioning_icp.sql",
    ]);

    await migrate(driver, before);

    // A pre-Phase-1 database: a user with a profile, a workspace, leads (incl. an import job).
    await db.exec(`
      insert into users (name, email, password_hash, company, pitch) values ('Owner', 'o@x.com', 'x', 'Owner Co', 'Old pitch');
      insert into workspaces (name, slug, created_by_user_id) values ('W', 'w', 1);
      insert into leads (workspace_id, full_name, email, company, job_title, source) values
        (1, 'Jane Doe', 'jane@acme.com', 'Acme Inc', 'CEO', 'csv'),
        (1, 'Joe Bloggs', 'info@acme.com', 'ACME', null, 'manual'),
        (1, 'Sam Solo', 'sam@gmail.com', null, null, 'manual');
      insert into import_jobs (workspace_id, source, file_name, total_rows, created_count) values (1, 'csv', 'old.csv', 3, 3);
    `);
    const snapshotBefore = (await db.query(`select id, full_name, email, company, job_title, source, stage from leads order by id`)).rows;

    const applied = await migrate(driver, all);
    expect(applied.appliedNow).toEqual(phase1.map((m: { file: string }) => m.file));

    // Existing rows are untouched and get safe defaults for the new columns.
    const snapshotAfter = (await db.query(`select id, full_name, email, company, job_title, source, stage from leads order by id`)).rows;
    expect(snapshotAfter).toEqual(snapshotBefore);
    const defaults = (await db.query<{ company_id: unknown; first_name: unknown; email_status: string }>(`select company_id, first_name, email_status from leads`)).rows;
    expect(defaults.every((r) => r.company_id === null && r.first_name === null && r.email_status === "unverified")).toBe(true);

    // Old import job keeps its data; new progress columns default sanely.
    const job = (await db.query<{ status: string; processed_rows: number; chunk_results: unknown }>(`select status, processed_rows, chunk_results from import_jobs`)).rows[0];
    expect(job).toMatchObject({ status: "completed", processed_rows: 0, chunk_results: {} });

    // 0007 seeded the workspace from the owner's legacy profile.
    const ws = (await db.query<{ positioning: string; company_name: string }>(`select positioning, company_name from workspaces`)).rows[0];
    expect(ws).toMatchObject({ positioning: "Old pitch", company_name: "Owner Co" });

    // Backfill: every lead that has any company information is linked; running again is a no-op.
    await backfillCompanies(driver);
    await backfillLeadNames(driver);
    await backfillEmailStatus(driver);
    const linked = (await db.query<{ full_name: string; company_id: number | null; first_name: string; email_status: string }>(
      `select full_name, company_id, first_name, email_status from leads order by id`)).rows;
    expect(linked[0].company_id).not.toBeNull();
    expect(linked[0].company_id).toBe(linked[1].company_id); // "Acme Inc" and "ACME" are one company
    expect(linked[2].company_id).toBeNull(); // free-mail, no company text: nothing to link
    expect(linked.map((l) => l.first_name)).toEqual(["Jane", "Joe", "Sam"]);
    expect(linked[1].email_status).toBe("risky"); // info@ role account

    const again = await backfillCompanies(driver);
    expect(again.byName.leadsLinked + again.byDomain.leadsLinked).toBe(0);
    await db.close();
  }, 60_000);

  it("the unique indexes enforce one company per domain and one name-only company per name, per workspace", async () => {
    const db = new PGlite();
    await migrate(pgliteDriver(db), loadMigrations(dir));
    await db.exec(`
      insert into users (name, email, password_hash) values ('U', 'u@x.com', 'x');
      insert into workspaces (name, slug) values ('A', 'a'), ('B', 'b');
      insert into companies (workspace_id, name, name_key, domain) values (1, 'Acme', 'acme', 'acme.com');
    `);
    await expect(db.exec(`insert into companies (workspace_id, name, name_key, domain) values (1, 'Acme 2', 'acme 2', 'ACME.com')`)).rejects.toThrow();
    await db.exec(`insert into companies (workspace_id, name, name_key, domain) values (2, 'Acme', 'acme', 'acme.com')`); // other workspace: fine
    await db.exec(`insert into companies (workspace_id, name, name_key) values (1, 'Acme', 'acme')`); // name-only alongside a domain company: fine
    await expect(db.exec(`insert into companies (workspace_id, name, name_key) values (1, 'ACME', 'acme')`)).rejects.toThrow();
    await expect(db.exec(`insert into companies (workspace_id, name, name_key) values (1, '', '')`)).rejects.toThrow(); // empty key rejected
    await expect(db.exec(`insert into leads (workspace_id, full_name, email_status) values (1, 'x', 'bogus')`)).rejects.toThrow();
    await db.close();
  });
});
