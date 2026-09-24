import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { createLeadImportService, leadImportService, sqlLeadImportRepository, type ChunkRow, type ImportCtx } from "@/lib/domain/leads/import/service";
import { companyService } from "@/lib/domain/companies/service";
import { DEFAULT_IMPORT_OPTIONS, IMPORT_CHUNK_SIZE, type ImportOptions } from "@/lib/domain/leads/import/preview";
import { createLogger, setLogSink } from "@/lib/log";
import { DnsMxResolver } from "@/lib/domain/leads/mx";

let ctx: ImportCtx;
let other: ImportCtx;

beforeEach(async () => {
  setLogSink(() => {});
  await resetDb();
  const a = await createWorkspace();
  const b = await createWorkspace();
  ctx = { workspaceId: a.workspaceId, userId: a.user.id };
  other = { workspaceId: b.workspaceId, userId: b.user.id };
});

const row = (n: number, extra: Record<string, string> = {}): ChunkRow => ({
  row: n + 1,
  data: { first_name: `First${n}`, last_name: `Last${n}`, email: `person${n}@company${n % 25}.com`, job_title: "Head of Growth", ...extra },
});

function chunksOf(rows: ChunkRow[], size = IMPORT_CHUNK_SIZE) {
  const out: ChunkRow[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

async function runImport(c: ImportCtx, rows: ChunkRow[], options: ImportOptions = DEFAULT_IMPORT_OPTIONS, service = leadImportService) {
  const job = await service.start(c, { fileName: "t.csv", totalRows: rows.length, options });
  let last = job;
  for (const [i, chunk] of chunksOf(rows).entries()) {
    last = (await service.importChunk(c, job.id, { index: i, rows: chunk })).job;
  }
  return service.finish(c, job.id).then((f) => ({ job: f, last }));
}

const count = async (ws: number, table = "leads") => Number((await sql.query(`select count(*)::int as n from ${table} where workspace_id = $1`, [ws]))[0].n);

describe("chunked import", () => {
  it("imports 1,000 leads in chunks, with progress, in well under 30s", async () => {
    const rows = Array.from({ length: 1000 }, (_, n) => row(n));
    const started = Date.now();
    const { job } = await runImport(ctx, rows);
    expect(Date.now() - started).toBeLessThan(30_000);
    expect(job).toMatchObject({ status: "completed", totalRows: 1000, processedRows: 1000, created: 1000, updated: 0, duplicate: 0, failed: 0 });
    expect(await count(ctx.workspaceId)).toBe(1000);
  }, 60_000);

  it("re-importing the same file creates 0 duplicates (skip mode) and reports every row as existing", async () => {
    const rows = Array.from({ length: 450 }, (_, n) => row(n));
    await runImport(ctx, rows);
    const { job } = await runImport(ctx, rows);
    expect(job).toMatchObject({ created: 0, duplicate: 450, processedRows: 450 });
    expect(await count(ctx.workspaceId)).toBe(450);
    const report = await leadImportService.report(ctx, job.id);
    expect(report.entries.filter((e) => e.code === "existing_skipped")).toHaveLength(450);
  }, 60_000);

  it("re-importing in update_blank mode is also idempotent (nothing blank left to fill)", async () => {
    const rows = Array.from({ length: 50 }, (_, n) => row(n));
    const opts: ImportOptions = { existing: "update_blank", checkMx: false };
    await runImport(ctx, rows, opts);
    const { job } = await runImport(ctx, rows, opts);
    expect(job).toMatchObject({ created: 0, updated: 0, duplicate: 50 });
    expect(await count(ctx.workspaceId)).toBe(50);
  });

  it("delivering the same chunk twice is a no-op (idempotent command)", async () => {
    const rows = Array.from({ length: 30 }, (_, n) => row(n));
    const job = await leadImportService.start(ctx, { totalRows: 30, options: DEFAULT_IMPORT_OPTIONS });
    const first = await leadImportService.importChunk(ctx, job.id, { index: 0, rows });
    const second = await leadImportService.importChunk(ctx, job.id, { index: 0, rows });
    expect(first.alreadyProcessed).toBe(false);
    expect(second.alreadyProcessed).toBe(true);
    expect(second.outcome).toEqual(first.outcome);
    expect(second.job.created).toBe(30);
    expect(second.job.processedRows).toBe(30);
    expect(await count(ctx.workspaceId)).toBe(30);
  });

  it("startImport with the same idempotency key resolves to one job", async () => {
    const a = await leadImportService.start(ctx, { totalRows: 5, options: DEFAULT_IMPORT_OPTIONS, idempotencyKey: "abc" });
    const b = await leadImportService.start(ctx, { totalRows: 5, options: DEFAULT_IMPORT_OPTIONS, idempotencyKey: "abc" });
    expect(b.id).toBe(a.id);
    expect(await count(ctx.workspaceId, "import_jobs")).toBe(1);
  });

  it("rejects oversize chunks, unknown jobs, other workspaces' jobs, and chunks after finish", async () => {
    const job = await leadImportService.start(ctx, { totalRows: 300, options: DEFAULT_IMPORT_OPTIONS });
    const tooMany = Array.from({ length: IMPORT_CHUNK_SIZE + 1 }, (_, n) => row(n));
    await expect(leadImportService.importChunk(ctx, job.id, { index: 0, rows: tooMany })).rejects.toThrow(/chunk must contain/);
    await expect(leadImportService.importChunk(ctx, 999999, { index: 0, rows: [row(1)] })).rejects.toThrow(/not found/i);
    await expect(leadImportService.importChunk(other, job.id, { index: 0, rows: [row(1)] })).rejects.toThrow(/not found/i);
    await leadImportService.finish(ctx, job.id);
    await expect(leadImportService.importChunk(ctx, job.id, { index: 1, rows: [row(1)] })).rejects.toThrow(/already finished/);
  });
});

describe("validation + dedupe inside the pipeline", () => {
  it("skips invalid rows with reasons, drops in-file duplicates, flags risky/role/disposable, keeps warnings", async () => {
    const rows: ChunkRow[] = [
      { row: 2, data: { full_name: "Good Person", email: "good@acme.com" } },
      { row: 3, data: { full_name: "No Name Email", email: "not-an-email" } },
      { row: 4, data: { email: "noname@acme.com" } },
      { row: 5, data: { full_name: "Dupe Person", email: "GOOD@acme.com" } }, // in-chunk dup of row 2
      { row: 6, data: { full_name: "Info Box", email: "info@acme.com" } },
      { row: 7, data: { full_name: "Throwaway", email: "x@mailinator.com" } },
      { row: 8, data: { full_name: "No Email Person", linkedin_url: "not a url" } },
      { row: 9, data: { full_name: "Client Marked Dup", email: "good@acme.com" }, duplicateOf: 2 },
    ];
    const { job } = await runImport(ctx, rows);
    expect(job).toMatchObject({ created: 4, skipped: 2, duplicate: 2, failed: 0 });

    const leads = await sql`select full_name, email, email_status, linkedin_url from leads where workspace_id = ${ctx.workspaceId} order by id`;
    const byName = Object.fromEntries(leads.map((l) => [l.full_name as string, l]));
    expect(byName["Info Box"].email_status).toBe("risky");
    expect(byName["Throwaway"].email_status).toBe("risky");
    expect(byName["Good Person"].email_status).toBe("unverified");
    expect(byName["No Email Person"].linkedin_url).toBeNull();
    expect(job.risky).toBe(2);

    const { entries } = await leadImportService.report(ctx, job.id);
    const codes = new Set(entries.map((e) => `${e.row}:${e.code}`));
    expect(codes).toContain("3:invalid_email");
    expect(codes).toContain("4:missing_name");
    expect(codes).toContain("5:duplicate_in_file");
    expect(codes).toContain("6:role_account");
    expect(codes).toContain("7:disposable_domain");
    expect(codes).toContain("8:invalid_linkedin_url");
    expect(codes).toContain("9:duplicate_in_file");
    expect(entries.find((e) => e.code === "invalid_email")?.severity).toBe("error");
  });

  it("existing leads: skip mode leaves them; update_blank fills ONLY blanks and never overwrites", async () => {
    await sql`insert into leads (workspace_id, full_name, first_name, email, company, job_title)
              values (${ctx.workspaceId}, 'Ann Existing', 'Ann', 'ann@acme.com', 'Old Co', 'CEO')`;
    const incoming: ChunkRow = {
      row: 2,
      data: { full_name: "Ann Renamed", email: "ann@acme.com", company: "New Co", job_title: "Intern", phone: "555-1234", last_name: "Existing" },
    };

    const skip = await runImport(ctx, [incoming], { existing: "skip", checkMx: false });
    expect(skip.job).toMatchObject({ created: 0, updated: 0, duplicate: 1 });

    const upd = await runImport(ctx, [incoming], { existing: "update_blank", checkMx: false });
    expect(upd.job).toMatchObject({ created: 0, updated: 1, duplicate: 0 });

    const [l] = await sql`select full_name, company, job_title, phone, last_name from leads where workspace_id = ${ctx.workspaceId}`;
    expect(l).toMatchObject({ full_name: "Ann Existing", company: "Old Co", job_title: "CEO", phone: "555-1234", last_name: "Existing" });
    expect(await count(ctx.workspaceId)).toBe(1);
  });

  it("dedupes email-less rows by LinkedIn profile across URL spellings", async () => {
    await sql`insert into leads (workspace_id, full_name, linkedin_url) values (${ctx.workspaceId}, 'Li Person', 'linkedin.com/in/lperson/')`;
    const { job } = await runImport(ctx, [{ row: 2, data: { full_name: "Li Person", linkedin_url: "https://www.linkedin.com/in/LPerson?trk=x" } }]);
    expect(job).toMatchObject({ created: 0, duplicate: 1 });
    expect(await count(ctx.workspaceId)).toBe(1);
  });

  it("re-import of bare rows (no email, no LinkedIn) does not duplicate them", async () => {
    const rows: ChunkRow[] = [{ row: 2, data: { full_name: "Bare Person", company: "Acme" } }];
    await runImport(ctx, rows);
    const { job } = await runImport(ctx, rows);
    expect(job.created).toBe(0);
    expect(await count(ctx.workspaceId)).toBe(1);
  });

  it("DNC emails are imported but flagged (blocked), never silently dropped", async () => {
    await sql`insert into do_not_contact (workspace_id, email) values (${ctx.workspaceId}, 'stop@acme.com')`;
    const { job } = await runImport(ctx, [{ row: 2, data: { full_name: "Stop Me", email: "STOP@acme.com" } }]);
    expect(job).toMatchObject({ created: 1, blocked: 1 });
    const [l] = await sql`select email from leads where workspace_id = ${ctx.workspaceId}`;
    expect(l.email).toBe("stop@acme.com");
    const { entries } = await leadImportService.report(ctx, job.id);
    expect(entries.some((e) => e.code === "do_not_contact")).toBe(true);
  });

  it("MX check (opt-in) marks domains without mail servers invalid", async () => {
    const mx = new DnsMxResolver(async (d) => {
      if (d === "dead-domain.com") throw Object.assign(new Error("nx"), { code: "ENOTFOUND" });
      return [{ exchange: "mx.example.net" }];
    });
    const svc = createLeadImportService({ repo: sqlLeadImportRepository, resolveCompanies: companyService.resolveCompanies, mx, log: createLogger() });
    const { job } = await runImport(
      ctx,
      [
        { row: 2, data: { full_name: "Live", email: "a@live-domain.com" } },
        { row: 3, data: { full_name: "Dead", email: "b@dead-domain.com" } },
      ],
      { existing: "skip", checkMx: true },
      svc,
    );
    expect(job.created).toBe(2);
    const rows = await sql`select full_name, email_status from leads where workspace_id = ${ctx.workspaceId}`;
    expect(Object.fromEntries(rows.map((r) => [r.full_name, r.email_status]))).toEqual({ Live: "valid", Dead: "invalid" });
  });
});

describe("companies during import", () => {
  it("links every lead that has company information; free-mail alone yields no company", async () => {
    const rows: ChunkRow[] = [
      { row: 2, data: { full_name: "A", email: "a@acme.com", company: "Acme Inc" } },
      { row: 3, data: { full_name: "B", email: "b@acme.com" } }, // domain only
      { row: 4, data: { full_name: "C", email: "c@gmail.com", company: "Acme" } }, // name only → name-only match...
      { row: 5, data: { full_name: "D", email: "d@gmail.com" } }, // nothing
      { row: 6, data: { full_name: "E", email: "e@beta.io", company_domain: "https://www.beta.io/about" } },
    ];
    await runImport(ctx, rows);
    const leads = await sql`
      select l.full_name, c.name as company_name, c.domain from leads l left join companies c on c.id = l.company_id
      where l.workspace_id = ${ctx.workspaceId} order by l.full_name`;
    const m = Object.fromEntries(leads.map((l) => [l.full_name, l]));
    expect(m.A).toMatchObject({ company_name: "Acme Inc", domain: "acme.com" });
    expect(m.B).toMatchObject({ domain: "acme.com" });
    expect(m.C).toMatchObject({ company_name: "Acme Inc" }); // single unambiguous name match
    expect(m.D.company_name).toBeNull();
    expect(m.E).toMatchObject({ domain: "beta.io" });
    expect(await count(ctx.workspaceId, "companies")).toBe(2);
  });

  it("never merges companies across workspaces", async () => {
    await runImport(ctx, [{ row: 2, data: { full_name: "A", email: "a@shared.com", company: "Shared" } }]);
    await runImport(other, [{ row: 2, data: { full_name: "B", email: "b@shared.com", company: "Shared" } }]);
    const rows = await sql`select workspace_id, count(*)::int as n from companies group by workspace_id`;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => Number(r.n) === 1)).toBe(true);
    const leads = await sql`select l.workspace_id, c.workspace_id as cw from leads l join companies c on c.id = l.company_id`;
    expect(leads.every((l) => l.workspace_id === l.cw)).toBe(true);
  });
});

describe("chunk failure isolation", () => {
  it("one poison row is isolated: the rest of its chunk and all other chunks still land", async () => {
    const poison = "POISON";
    const faulty = {
      ...sqlLeadImportRepository,
      writeChunk: (async (ws, jobId, inserts, updates, progress) => {
        if (inserts.some((i) => i.full_name.includes(poison))) throw new Error("boom");
        return sqlLeadImportRepository.writeChunk(ws, jobId, inserts, updates, progress);
      }) as typeof sqlLeadImportRepository.writeChunk,
      writeRows: (async (ws, inserts, updates) => {
        if (inserts.some((i) => i.full_name.includes(poison))) throw new Error("boom");
        return sqlLeadImportRepository.writeRows(ws, inserts, updates);
      }) as typeof sqlLeadImportRepository.writeRows,
    };
    const svc = createLeadImportService({ repo: faulty, resolveCompanies: companyService.resolveCompanies, mx: new DnsMxResolver(), log: createLogger() });

    const rows = Array.from({ length: 450 }, (_, n) => row(n));
    rows[250] = { row: 252, data: { full_name: `${poison} Person`, email: "poison@bad.com" } }; // lives in chunk 1
    const { job } = await runImport(ctx, rows, DEFAULT_IMPORT_OPTIONS, svc);

    expect(job).toMatchObject({ created: 449, failed: 1, processedRows: 450, status: "completed_with_errors" });
    expect(await count(ctx.workspaceId)).toBe(449);
    const { entries } = await svc.report(ctx, job.id);
    expect(entries.filter((e) => e.code === "save_failed")).toEqual([
      expect.objectContaining({ row: 252, severity: "error" }),
    ]);
    // Earlier chunks were never touched by the failure: 3 chunks recorded.
    const [j] = await sql`select chunk_results from import_jobs where id = ${job.id}`;
    expect(Object.keys(j.chunk_results as object).sort()).toEqual(["0", "1", "2"]);
  }, 60_000);

  it("an interrupted import (chunks missing) finishes as 'interrupted', keeping what landed", async () => {
    const rows = Array.from({ length: 400 }, (_, n) => row(n));
    const job = await leadImportService.start(ctx, { totalRows: 400, options: DEFAULT_IMPORT_OPTIONS });
    await leadImportService.importChunk(ctx, job.id, { index: 0, rows: rows.slice(0, 200) });
    const finished = await leadImportService.finish(ctx, job.id);
    expect(finished).toMatchObject({ status: "interrupted", created: 200, processedRows: 200 });
    expect(await count(ctx.workspaceId)).toBe(200);
  });
});

describe("lookupExisting", () => {
  it("reports existing and DNC emails for the preview, scoped to the workspace", async () => {
    await sql`insert into leads (workspace_id, full_name, email) values (${ctx.workspaceId}, 'E', 'here@acme.com'), (${other.workspaceId}, 'O', 'there@acme.com')`;
    await sql`insert into do_not_contact (workspace_id, email) values (${ctx.workspaceId}, 'stop@acme.com')`;
    const r = await leadImportService.lookupExisting(ctx, ["HERE@acme.com", "there@acme.com", "stop@acme.com", "new@acme.com", "garbage"]);
    expect(r.existing).toEqual(["here@acme.com"]);
    expect(r.blocked).toEqual(["stop@acme.com"]);
  });
});
