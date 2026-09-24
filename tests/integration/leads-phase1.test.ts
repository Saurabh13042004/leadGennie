import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace, createUser } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { createLead, updateLead, getLeadsPage, getLead, importLeadsCsv } from "@/lib/actions/leads";
import { bulkAddToDnc, bulkDeleteLeads } from "@/lib/actions/leads-bulk";
import { searchCompanies } from "@/lib/actions/companies";
import { companyService } from "@/lib/domain/companies/service";
import { LEAD_PAGE_SIZE } from "@/lib/domain/leads/list-query";

let A: { workspaceId: number; user: { id: number; email: string } };
let B: typeof A;

function actAs(w: typeof A, role: "owner" | "admin" | "member" | "viewer" = "owner") {
  setSession({ workspaceId: w.workspaceId, userId: w.user.id, email: w.user.email, role });
}
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  actAs(A);
});

describe("createLead / updateLead", () => {
  it("links the lead to a company (by email domain), classifies the email, splits the name", async () => {
    const lead = await createLead({ full_name: "Dr. Jane Doe", email: "Jane@Acme.com", company: "Acme Inc" });
    expect(lead).toMatchObject({ first_name: "Jane", last_name: "Doe", email: "jane@acme.com", email_status: "unverified" });
    const c = await one(sql`select name, domain from companies where id = ${lead.company_id}`);
    expect(c).toMatchObject({ name: "Acme Inc", domain: "acme.com" });
    const act = await sql`select type from activities where workspace_id = ${A.workspaceId}`;
    expect(act.map((a) => a.type)).toContain("lead.created");
  });

  it("free-mail addresses never create a domain company; the company name still links", async () => {
    const lead = await createLead({ full_name: "Sam Solo", email: "sam@gmail.com", company: "Solo Works" });
    const c = await one(sql`select name, domain from companies where id = ${lead.company_id}`);
    expect(c).toMatchObject({ name: "Solo Works", domain: null });
    const noCompany = await createLead({ full_name: "No Co", email: "noco@gmail.com" });
    expect(noCompany.company_id).toBeNull();
  });

  it("flags role accounts as risky; rejects bad emails, bad LinkedIn URLs, missing names, duplicates", async () => {
    expect((await createLead({ full_name: "Front Desk", email: "info@acme.com" })).email_status).toBe("risky");
    await expect(createLead({ full_name: "X", email: "nope" })).rejects.toThrow(/invalid email/i);
    await expect(createLead({ full_name: "X", linkedin_url: "https://example.com/x" })).rejects.toThrow(/linkedin/i);
    await expect(createLead({ full_name: "  " })).rejects.toThrow(/name/i);
    await expect(createLead({ full_name: "Dup", email: "INFO@acme.com" })).rejects.toThrow(/already exists/);
  });

  it("update: re-links the company, keeps an upgraded email status when the email is unchanged, re-classifies a changed one", async () => {
    const lead = await createLead({ full_name: "Kim Lee", email: "kim@acme.com", company: "Acme" });
    await sql`update leads set email_status = 'valid' where id = ${lead.id}`;

    const same = await updateLead(lead.id, { full_name: "Kim Lee", email: "KIM@acme.com", company: "Globex", company_domain: "globex.com" });
    expect(same.email_status).toBe("valid");
    expect(await one(sql`select domain from companies where id = ${same.company_id}`)).toMatchObject({ domain: "globex.com" });
    expect(same.company_id).not.toBe(lead.company_id);

    const changed = await updateLead(lead.id, { full_name: "Kim Lee", email: "support@acme.com" });
    expect(changed.email_status).toBe("risky");
    const cleared = await updateLead(lead.id, { full_name: "Kim Lee", email: "kim2@gmail.com" });
    expect(cleared.company_id).toBeNull();
  });
});

describe("companies", () => {
  it("matchOrCreateCompany is idempotent, even under concurrent calls", async () => {
    const ctx = { workspaceId: A.workspaceId };
    const results = await Promise.all(Array.from({ length: 6 }, () => companyService.matchOrCreateCompany(ctx, { name: "Initech LLC", domain: "initech.com" })));
    expect(new Set(results.map((r) => r!.id)).size).toBe(1);
    expect(Number((await one(sql`select count(*)::int as n from companies`)).n)).toBe(1);
  });

  it("a name-only company adopts its domain; a different domain with the same name is kept separate", async () => {
    const ctx = { workspaceId: A.workspaceId };
    const first = await companyService.matchOrCreateCompany(ctx, { name: "Globex", domain: null });
    const adopted = await companyService.matchOrCreateCompany(ctx, { name: "Globex Corp", domain: "globex.com" });
    expect(adopted!.id).toBe(first!.id);
    expect((await one(sql`select domain from companies where id = ${first!.id}`)).domain).toBe("globex.com");

    const other = await companyService.matchOrCreateCompany(ctx, { name: "Globex", domain: "globex.io" });
    expect(other!.id).not.toBe(first!.id);
    expect(Number((await one(sql`select count(*)::int as n from companies`)).n)).toBe(2);
  });

  it("returns null when there is nothing to match on", async () => {
    expect(await companyService.matchOrCreateCompany({ workspaceId: A.workspaceId }, { name: " ", domain: "nonsense" })).toBeNull();
  });

  it("autocomplete only ever suggests this workspace's companies", async () => {
    await companyService.matchOrCreateCompany({ workspaceId: A.workspaceId }, { name: "Acme A", domain: "acme-a.com" });
    await companyService.matchOrCreateCompany({ workspaceId: B.workspaceId }, { name: "Acme B (secret)", domain: "acme-b.com" });
    const r = await searchCompanies("acme");
    expect(r.map((c) => c.name)).toEqual(["Acme A"]);
    expect(JSON.stringify(await searchCompanies(""))).not.toContain("secret");
  });
});

describe("lead list: server-side pagination", () => {
  async function seed(n: number, ws = A.workspaceId) {
    await sql.query(
      `insert into companies (workspace_id, name, name_key, domain)
       select $1, 'Co ' || g, 'co ' || g, 'co' || g || '.com' from generate_series(1, 500) g`,
      [ws],
    );
    await sql.query(
      `insert into leads (workspace_id, full_name, first_name, email, email_status, company, company_id, job_title, stage, source, created_at)
       select $1, 'Lead ' || lpad(g::text, 5, '0'), 'Lead', 'lead' || g || '@co' || (g % 500 + 1) || '.com',
              (array['unverified','valid','risky','invalid'])[g % 4 + 1], 'Co ' || (g % 500 + 1), c.id,
              (array['VP Sales','Founder','Engineer'])[g % 3 + 1],
              (array['new','outreached','engaged'])[g % 3 + 1], (array['csv','manual','linkedin_extension'])[g % 3 + 1],
              now() - (g || ' minutes')::interval
       from generate_series(1, $2::int) g
       join companies c on c.workspace_id = $1 and c.name_key = 'co ' || (g % 500 + 1)`,
      [ws, n],
    );
  }

  it("5,000 leads: first page returns 50 rows in well under 1 second", async () => {
    await seed(5000);
    await getLeadsPage({}); // warm the in-process DB; the timing below is the steady-state query cost
    const started = performance.now();
    const { page } = await getLeadsPage({});
    const ms = performance.now() - started;
    expect(page.rows).toHaveLength(LEAD_PAGE_SIZE);
    expect(page.total).toBe(5000);
    expect(page.pageCount).toBe(100);
    expect(ms).toBeLessThan(1000);
  }, 60_000);

  it("pages are disjoint and complete; out-of-range pages clamp to the last page", async () => {
    await seed(120);
    const ids = new Set<number>();
    for (const p of [1, 2, 3]) {
      const { page } = await getLeadsPage({ page: String(p) });
      page.rows.forEach((r) => ids.add(r.id));
      expect(page.rows.length).toBe(p === 3 ? 20 : 50);
    }
    expect(ids.size).toBe(120);
    const last = (await getLeadsPage({ page: "999" })).page;
    expect(last.page).toBe(3);
    expect(last.rows).toHaveLength(20);
  });

  it("filters by stage / source / email status / company and combines them", async () => {
    await seed(300);
    const stage = (await getLeadsPage({ stage: "engaged" })).page;
    expect(stage.total).toBe(100);
    expect(stage.rows.every((r) => r.stage === "engaged")).toBe(true);
    const combo = (await getLeadsPage({ stage: "engaged", source: "manual", email_status: "risky" })).page;
    expect(combo.rows.every((r) => r.stage === "engaged" && r.source === "manual" && r.email_status === "risky")).toBe(true);
    const c = await one(sql`select id from companies where name_key = 'co 7'`);
    const byCompany = (await getLeadsPage({ company: String(c.id) })).page;
    expect(byCompany.total).toBeGreaterThan(0);
    expect(byCompany.rows.every((r) => r.company_name === "Co 7")).toBe(true);
    expect((await getLeadsPage({ stage: "nonexistent" })).page.total).toBe(0);
    expect((await getLeadsPage({})).page.facets.stages.map((f) => f.value).sort()).toEqual(["engaged", "new", "outreached"]);
  });

  it("search matches name, email, company and title; % and _ are literal", async () => {
    await createLead({ full_name: "Zed Unique", email: "zed@zedco.com", company: "Zedco", job_title: "Chief Wizard" });
    await createLead({ full_name: "Fifty Percent", email: "fifty@acme.com", company: "50% Off Inc" });
    const find = async (q: string) => (await getLeadsPage({ q })).page.rows.map((r) => r.full_name);
    expect(await find("zed unique")).toEqual(["Zed Unique"]);
    expect(await find("zedco.com")).toEqual(["Zed Unique"]);
    expect(await find("wizard")).toEqual(["Zed Unique"]);
    expect(await find("50%")).toEqual(["Fifty Percent"]);
    expect(await find("%")).toEqual(["Fifty Percent"]); // a bare % must not match everything
    expect(await find("_")).toEqual([]);
  });

  it("sorts by an allow-listed column; an unknown sort falls back safely (no SQL injection)", async () => {
    await seed(60);
    const byName = (await getLeadsPage({ sort: "name", dir: "asc" })).page.rows.map((r) => r.full_name);
    expect(byName).toEqual([...byName].sort());
    const evil = await getLeadsPage({ sort: "id; drop table leads;--", dir: "sideways" });
    expect(evil.query).toMatchObject({ sort: "created", dir: "desc" });
    expect(evil.page.total).toBe(60);
  });

  it("marks Do Not Contact leads as blocked, derived live", async () => {
    const lead = await createLead({ full_name: "Stop Me", email: "stop@acme.com" });
    expect((await getLead(lead.id))!.blocked).toBe(false);
    await sql`insert into do_not_contact (workspace_id, email) values (${A.workspaceId}, 'STOP@acme.com')`;
    expect((await getLead(lead.id))!.blocked).toBe(true);
    expect((await getLeadsPage({})).page.rows[0].blocked).toBe(true);
  });

  it("'No email' filter finds leads without one", async () => {
    await createLead({ full_name: "Has Email", email: "h@acme.com" });
    await createLead({ full_name: "Linkedin Only", linkedin_url: "https://linkedin.com/in/lo" });
    expect((await getLeadsPage({ email_status: "none" })).page.rows.map((r) => r.full_name)).toEqual(["Linkedin Only"]);
  });
});

describe("bulk actions", () => {
  it("adds emails to Do Not Contact, once each, reporting leads without an email", async () => {
    const l1 = await createLead({ full_name: "One", email: "one@acme.com" });
    const l2 = await createLead({ full_name: "Two", email: "two@acme.com" });
    const l3 = await createLead({ full_name: "Three" });
    await sql`insert into do_not_contact (workspace_id, email) values (${A.workspaceId}, 'two@acme.com')`;
    const res = await bulkAddToDnc([l1.id, l2.id, l3.id]);
    expect(res).toEqual({ ok: true, data: { selected: 3, withEmail: 2, added: 1 } });
    const dnc = await sql`select email, source from do_not_contact where workspace_id = ${A.workspaceId} order by email`;
    expect(dnc.map((d) => d.email)).toEqual(["one@acme.com", "two@acme.com"]);
    expect((await getLead(l1.id))!.blocked).toBe(true);
  });

  it("bulk delete keeps contacted leads and never deletes across workspaces", async () => {
    const free = await createLead({ full_name: "Free", email: "free@acme.com" });
    const sent = await createLead({ full_name: "Sent", email: "sent@acme.com" });
    const camp = await one(sql`insert into campaigns (workspace_id, name, status) values (${A.workspaceId}, 'C', 'running') returning id`);
    const step = await one(sql`insert into campaign_steps (campaign_id, step_order, channel, body) values (${camp.id}, 1, 'email', 'b') returning id`);
    await sql`insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, body)
              values (${A.workspaceId}, ${camp.id}, ${sent.id}, ${step.id}, 'email', 'sent', now(), 'b')`;
    const foreign = await one(sql`insert into leads (workspace_id, full_name) values (${B.workspaceId}, 'B lead') returning id`);

    const res = await bulkDeleteLeads([free.id, sent.id, Number(foreign.id)]);
    expect(res).toEqual({ ok: true, data: { deleted: 1, keptBecauseContacted: 1 } });
    expect(Number((await one(sql`select count(*)::int as n from leads where workspace_id = ${B.workspaceId}`)).n)).toBe(1);
    expect(Number((await one(sql`select count(*)::int as n from leads where id = ${sent.id}`)).n)).toBe(1);
  });

  it("enforces roles and validates input with envelope errors, not thrown stacks", async () => {
    const l = await createLead({ full_name: "Role Test", email: "role@acme.com" });
    actAs(A, "viewer");
    expect(await bulkAddToDnc([l.id])).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    actAs(A, "member");
    expect(await bulkDeleteLeads([l.id])).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    expect(await bulkAddToDnc([])).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(await bulkAddToDnc([1.5 as number])).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    setSession(null);
    expect(await bulkAddToDnc([l.id])).toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
  });
});

describe("workspace isolation (Phase 1 surfaces)", () => {
  it("A never sees, filters into, or mutates B's leads/companies", async () => {
    actAs(B);
    const bLead = await createLead({ full_name: "B Secret", email: "secret@b-corp.com", company: "B Corp" });
    const bCompany = Number(bLead.company_id);
    actAs(A);
    await createLead({ full_name: "A Person", email: "a@a-corp.com", company: "A Corp" });

    const list = JSON.stringify((await getLeadsPage({})).page);
    expect(list).not.toContain("B Secret");
    expect(list).not.toContain("B Corp");
    expect((await getLeadsPage({ company: String(bCompany) })).page.total).toBe(0);
    expect(await getLead(bLead.id)).toBeNull();
    await expect(updateLead(bLead.id, { full_name: "pwned" })).rejects.toThrow(/not found/i);
    expect(await bulkAddToDnc([bLead.id])).toMatchObject({ ok: true, data: { selected: 0, added: 0 } });
    expect(await bulkDeleteLeads([bLead.id])).toMatchObject({ ok: true, data: { deleted: 0 } });

    // Same company name in each workspace = two companies, each linked only to its own leads.
    await createLead({ full_name: "A Shared", email: "x@shared.com", company: "Shared Co" });
    actAs(B);
    await createLead({ full_name: "B Shared", email: "y@shared.com", company: "Shared Co" });
    const rows = await sql`
      select l.workspace_id as lw, c.workspace_id as cw from leads l join companies c on c.id = l.company_id`;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.lw === r.cw)).toBe(true);
    expect(Number((await one(sql`select count(*)::int as n from companies where name = 'Shared Co'`)).n)).toBe(2);
  });

  it("the extension-style insert (machine source) keeps valid data and drops bad LinkedIn URLs with a warning, not an error", async () => {
    const { insertLead } = await import("@/lib/db/leads-core");
    const lead = await insertLead(A.workspaceId, { full_name: "Ext Person", linkedin_url: "not-a-url", company: "Ext Co" }, "linkedin_extension");
    expect(lead.linkedin_url).toBeNull();
    expect(lead.company_id).not.toBeNull();
    expect((await one(sql`select source from companies where id = ${lead.company_id}`)).source).toBe("extension");
  });
});

describe("importLeadsCsv (compatibility wrapper)", () => {
  it("runs the new pipeline: created/duplicate accounting, and re-running creates nothing", async () => {
    const rows = [
      { full_name: "P One", email: "p1@acme.com", company: "Acme" },
      { full_name: "P Two", email: "p2@acme.com", company: "Acme" },
      { full_name: "P One Again", email: "P1@acme.com" },
      { full_name: "", email: "x@acme.com" },
    ];
    const first = await importLeadsCsv(rows, "t.csv");
    expect(first).toMatchObject({ total: 4, created: 2, duplicate: 1, skipped: 1, failed: 0 });
    const second = await importLeadsCsv(rows, "t.csv");
    expect(second.created).toBe(0);
    expect(Number((await one(sql`select count(*)::int as n from leads where workspace_id = ${A.workspaceId}`)).n)).toBe(2);
    expect(Number((await one(sql`select count(*)::int as n from companies where workspace_id = ${A.workspaceId}`)).n)).toBe(1);
    void createUser;
  });
});
