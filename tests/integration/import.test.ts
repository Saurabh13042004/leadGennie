import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { setSession } from "../helpers/session";
import { createWorkspace } from "../helpers/factories";
import { importLeadsCsv } from "@/lib/actions/leads";

const rows = [
  { full_name: "Ada Lovelace", email: "ada@example.com", company: "Analytical", job_title: "CTO" },
  { full_name: "Grace Hopper", email: "GRACE@example.com", company: "Navy" },
  { full_name: "", email: "noname@example.com" },
  { full_name: "Ada Again", email: "ada@example.com" },
];

let workspaceId: number;
beforeEach(async () => {
  await resetDb();
  const ws = await createWorkspace();
  workspaceId = ws.workspaceId;
  setSession({ workspaceId, userId: ws.user.id, email: ws.user.email });
});

const leadCount = async () => Number((await sql`select count(*) as n from leads where workspace_id = ${workspaceId}`)[0].n);

describe("CSV import", () => {
  it("accounts for every row: created / skipped / duplicate, and records an import job", async () => {
    const r = await importLeadsCsv(rows, "first.csv");
    expect(r).toMatchObject({ total: 4, created: 2, updated: 0, duplicate: 1, skipped: 1, failed: 0 });
    expect(r.errors.map((e) => e.row).sort()).toEqual([3, 4]);
    const [job] = await sql`select file_name, total_rows, created_count, status from import_jobs where id = ${r.jobId}`;
    expect(job).toMatchObject({ file_name: "first.csv", status: "completed" });
    expect(Number(job.total_rows)).toBe(4);
  });

  it("is idempotent: re-importing the same file creates nothing new", async () => {
    await importLeadsCsv(rows);
    const again = await importLeadsCsv(rows);
    expect(again.created).toBe(0);
    expect(again.updated).toBe(2);
    expect(await leadCount()).toBe(2);
  });

  it("matches emails case-insensitively and enriches without erasing existing fields", async () => {
    await importLeadsCsv([{ full_name: "Grace Hopper", email: "grace@example.com", company: "Navy", job_title: "Admiral" }]);
    const r = await importLeadsCsv([{ full_name: "Grace H.", email: "GRACE@EXAMPLE.COM" }]); // no company/title in this file
    expect(r).toMatchObject({ created: 0, updated: 1 });
    const [lead] = await sql`select full_name, company, job_title from leads where workspace_id = ${workspaceId}`;
    expect(lead).toMatchObject({ full_name: "Grace H.", company: "Navy", job_title: "Admiral" });
    expect(await leadCount()).toBe(1);
  });

  it.todo("leads WITHOUT an email have no identity to dedupe on — re-import duplicates them (known gap; Phase 1 adds linkedin_url/domain matching)");
});
