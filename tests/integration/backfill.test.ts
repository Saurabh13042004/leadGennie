import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, getTestDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { pgliteDriver } from "../../scripts/lib/migrator.mjs";
import { backfillCompanies, backfillEmailStatus, backfillLeadNames } from "../../scripts/lib/backfill.mjs";

let A: number;
let B: number;

async function driver() {
  return pgliteDriver(await getTestDb());
}
async function legacyLead(ws: number, name: string, email: string | null, company: string | null) {
  await sql`insert into leads (workspace_id, full_name, email, company) values (${ws}, ${name}, ${email}, ${company})`;
}
const snapshot = async () =>
  JSON.stringify([
    await sql`select id, company_id, first_name, last_name, email_status from leads order by id`,
    await sql`select id, workspace_id, name, name_key, domain from companies order by id`,
  ]);

beforeEach(async () => {
  await resetDb();
  A = (await createWorkspace()).workspaceId;
  B = (await createWorkspace()).workspaceId;
});

describe("backfill: companies", () => {
  async function seed() {
    await legacyLead(A, "L1", "l1@acme.com", "Acme Inc");
    await legacyLead(A, "L2", "l2@gmail.com", "ACME, inc.");
    await legacyLead(A, "L3", null, "Acme");
    await legacyLead(A, "L4", "l4@initech.com", null); // domain only
    await legacyLead(A, "L5", "l5@gmail.com", null); // free-mail, no company → stays unlinked
    await legacyLead(A, "L6", null, "!!!"); // nothing usable
    await legacyLead(A, "L7", null, "  "); // blank
    await legacyLead(A, "L8", "l8@globex.com", "Globex Corp");
    await legacyLead(B, "B1", "b1@acme.com", "Acme Inc"); // same name, OTHER workspace
    await sql`insert into companies (workspace_id, name, name_key, domain) values (${A}, 'Globex', 'globex', 'globex.com')`;
  }

  it("links leads by normalized name / corporate domain, per workspace, without false merges", async () => {
    await seed();
    const stats = await backfillCompanies(await driver(), { batchSize: 2 }); // tiny batches exercise keyset paging
    const rows = await sql`
      select l.full_name, l.workspace_id, c.id as cid, c.name, c.domain, c.workspace_id as cws
      from leads l left join companies c on c.id = l.company_id order by l.full_name`;
    const by = Object.fromEntries(rows.map((r) => [r.full_name as string, r]));

    expect(by.L1.cid).toBe(by.L2.cid);
    expect(by.L1.cid).toBe(by.L3.cid); // "Acme Inc" / "ACME, inc." / "Acme" → ONE company
    expect(by.L1.name).toBe("ACME, inc."); // first variant seen wins as the display name (sorted)
    expect(by.L4.domain).toBe("initech.com");
    expect(by.L5.cid).toBeNull();
    expect(by.L6.cid).toBeNull();
    expect(by.L7.cid).toBeNull();
    expect(by.L8.cid).not.toBeNull();
    expect(by.L8.domain).toBe("globex.com"); // linked to the existing domain company, not a duplicate
    expect(by.B1.cid).not.toBe(by.L1.cid); // never crosses workspaces
    expect(Number(by.B1.cws)).toBe(B);
    for (const r of rows) if (r.cid !== null) expect(Number(r.cws)).toBe(Number(r.workspace_id));

    expect(stats.byName.leadsLinked + stats.byDomain.leadsLinked).toBe(6);
    const [{ n }] = await sql`select count(*)::int as n from companies where workspace_id = ${A}`;
    expect(Number(n)).toBe(3); // acme (name-only), globex (pre-existing), initech.com
  });

  it("running it twice is a no-op", async () => {
    await seed();
    await backfillCompanies(await driver());
    const once = await snapshot();
    const second = await backfillCompanies(await driver());
    expect(second.byName).toEqual({ leadsLinked: 0, companiesCreated: 0 });
    expect(second.byDomain).toEqual({ leadsLinked: 0, companiesCreated: 0 });
    expect(await snapshot()).toBe(once);
  });

  it("never touches leads that already have a company_id", async () => {
    await sql`insert into companies (workspace_id, name, name_key, domain) values (${A}, 'Manual Pick', 'manual pick', 'manual.io')`;
    const [{ id }] = await sql`select id from companies`;
    await sql`insert into leads (workspace_id, full_name, company, company_id) values (${A}, 'Keep', 'Acme', ${id})`;
    await backfillCompanies(await driver());
    const [l] = await sql`select company_id from leads`;
    expect(Number(l.company_id)).toBe(Number(id));
  });
});

describe("backfill: lead names", () => {
  it("splits full_name, leaves existing first/last and blank names alone, and is idempotent", async () => {
    await legacyLead(A, "Jane Doe", null, null);
    await legacyLead(A, "Cher", null, null);
    await legacyLead(A, "Dr. Ada Lovelace Jr.", null, null);
    await sql`insert into leads (workspace_id, full_name, first_name, last_name) values (${A}, 'Manual Person', 'Custom', 'Kept')`;

    const first = await backfillLeadNames(await driver(), { batchSize: 2 });
    expect(first.updated).toBe(3);
    const rows = await sql`select full_name, first_name, last_name from leads order by id`;
    expect(rows.map((r) => [r.full_name, r.first_name, r.last_name])).toEqual([
      ["Jane Doe", "Jane", "Doe"],
      ["Cher", "Cher", null],
      ["Dr. Ada Lovelace Jr.", "Ada", "Lovelace"],
      ["Manual Person", "Custom", "Kept"],
    ]);
    expect((await backfillLeadNames(await driver())).updated).toBe(0);
  });
});

describe("backfill: email status", () => {
  it("flags role/disposable/invalid, leaves clean and already-classified leads, is idempotent", async () => {
    await legacyLead(A, "Clean", "clean@acme.com", null);
    await legacyLead(A, "Role", "info@acme.com", null);
    await legacyLead(A, "Temp", "x@mailinator.com", null);
    await legacyLead(A, "Broken", "not-an-email", null);
    await legacyLead(A, "NoEmail", null, null);
    await sql`insert into leads (workspace_id, full_name, email, email_status) values (${A}, 'Verified', 'info@verified.com', 'valid')`;

    const r = await backfillEmailStatus(await driver(), { batchSize: 2 });
    expect(r.updated).toBe(3);
    const rows = await sql`select full_name, email_status from leads order by id`;
    expect(Object.fromEntries(rows.map((x) => [x.full_name, x.email_status]))).toEqual({
      Clean: "unverified", Role: "risky", Temp: "risky", Broken: "invalid", NoEmail: "unverified", Verified: "valid",
    });
    expect((await backfillEmailStatus(await driver())).updated).toBe(0);
  });
});
