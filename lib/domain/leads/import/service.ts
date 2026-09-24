import { AppError } from "@/lib/api/errors";
import * as importRepo from "@/lib/db/lead-import";
import type { ChunkOutcome, ImportJobRow, InsertRow, ProgressDelta, ReportEntry } from "@/lib/db/lead-import";
import { companyService, type CompanyResolution, type TenantCtx } from "@/lib/domain/companies/service";
import { normalizeCompanyName } from "@/lib/domain/companies/normalize";
import { createLogger, type Logger } from "@/lib/log";
import { emailDomain, normalizeEmail, isValidEmailSyntax, type MxResult } from "../email";
import { defaultMxResolver, resolveDomains, type MxResolver } from "../mx";
import { linkedinSlug } from "../urls";
import { validateLeadInput, type LeadInput, type NormalizedLead } from "../validate";
import { computeFill, type FillPatch } from "./merge";
import { IMPORT_CHUNK_SIZE, MAX_IMPORT_ROWS, type ImportOptions } from "./preview";

/**
 * The import pipeline's server side (Validate → Dedupe → Import), one chunk at
 * a time. A chunk is a serializable command: (job, index, rows). Delivering it
 * twice is a no-op because the outcome is recorded under its index in the same
 * atomic statement that writes the rows. The server never trusts the client's
 * preview — every row is re-validated here.
 */

export type ImportCtx = TenantCtx & { userId: number };
export type ChunkRow = { row: number; data: LeadInput; duplicateOf?: number };
export type ChunkInput = { index: number; rows: ChunkRow[] };

export type ImportJobView = {
  id: number;
  status: string;
  fileName: string | null;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  duplicate: number;
  skipped: number;
  failed: number;
  blocked: number;
  risky: number;
  finished: boolean;
};

export type ChunkResult = { outcome: ChunkOutcome; job: ImportJobView; alreadyProcessed: boolean };

/** Persistence the service needs — a role interface, substitutable in tests. */
export interface LeadImportRepository {
  createJob: typeof importRepo.createImportJob;
  getJob: typeof importRepo.getImportJob;
  finishJob: typeof importRepo.finishImportJob;
  findExisting: typeof importRepo.findExistingLeads;
  findDnc: typeof importRepo.findDncEmails;
  findExistingEmails: typeof importRepo.findExistingEmails;
  writeChunk: typeof importRepo.writeChunk;
  writeRows: typeof importRepo.writeRows;
  recordProgress: typeof importRepo.recordChunkProgress;
  appendReport: typeof importRepo.appendErrorReport;
  getReport: typeof importRepo.getImportErrorReport;
}

export const sqlLeadImportRepository: LeadImportRepository = {
  createJob: importRepo.createImportJob,
  getJob: importRepo.getImportJob,
  finishJob: importRepo.finishImportJob,
  findExisting: importRepo.findExistingLeads,
  findDnc: importRepo.findDncEmails,
  findExistingEmails: importRepo.findExistingEmails,
  writeChunk: importRepo.writeChunk,
  writeRows: importRepo.writeRows,
  recordProgress: importRepo.recordChunkProgress,
  appendReport: importRepo.appendErrorReport,
  getReport: importRepo.getImportErrorReport,
};

export type ImportDeps = {
  repo: LeadImportRepository;
  resolveCompanies: (ctx: TenantCtx, inputs: { name: string | null; domain: string | null }[], source: "import") => Promise<CompanyResolution>;
  mx: MxResolver;
  log: Logger;
};

export function toJobView(job: ImportJobRow): ImportJobView {
  return {
    id: job.id,
    status: job.status,
    fileName: job.file_name,
    totalRows: job.total_rows,
    processedRows: job.processed_rows,
    created: job.created_count,
    updated: job.updated_count,
    duplicate: job.duplicate_count,
    skipped: job.skipped_count,
    failed: job.failed_count,
    blocked: job.blocked_count,
    risky: job.risky_count,
    finished: job.status !== "running",
  };
}

type Valid = { row: number; lead: NormalizedLead };

/** Identity of a row for in-chunk duplicate detection when it has no email. */
function fallbackKey(lead: NormalizedLead): string {
  if (lead.email) return `e:${lead.email}`;
  const slug = linkedinSlug(lead.linkedinUrl);
  if (slug) return `l:${slug}`;
  return `n:${lead.fullName.toLowerCase()}|${normalizeCompanyName(lead.company)}`;
}

export function createLeadImportService(deps: ImportDeps) {
  const { repo, log } = deps;

  async function loadJob(ctx: ImportCtx, jobId: number): Promise<ImportJobRow> {
    const job = await repo.getJob(ctx.workspaceId, jobId);
    if (!job) throw new AppError("NOT_FOUND", "Import not found.");
    return job;
  }

  async function start(
    ctx: ImportCtx,
    meta: { fileName?: string | null; totalRows: number; options: ImportOptions; idempotencyKey?: string | null },
  ): Promise<ImportJobView> {
    if (!Number.isInteger(meta.totalRows) || meta.totalRows < 1) throw new AppError("VALIDATION_ERROR", "The file has no rows to import.");
    if (meta.totalRows > MAX_IMPORT_ROWS) {
      throw new AppError("VALIDATION_ERROR", `Imports are limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows at a time — split the file.`);
    }
    const job = await repo.createJob(ctx.workspaceId, ctx.userId, {
      fileName: meta.fileName?.slice(0, 255) ?? null,
      totalRows: meta.totalRows,
      options: meta.options,
      idempotencyKey: meta.idempotencyKey ?? null,
    });
    return toJobView(job);
  }

  async function importChunk(ctx: ImportCtx, jobId: number, chunk: ChunkInput): Promise<ChunkResult> {
    const job = await loadJob(ctx, jobId);

    const recorded = job.chunk_results[String(chunk.index)];
    if (recorded) return { outcome: recorded, job: toJobView(job), alreadyProcessed: true };
    if (job.status !== "running") throw new AppError("CONFLICT", "This import has already finished.");
    if (chunk.rows.length === 0 || chunk.rows.length > IMPORT_CHUNK_SIZE) {
      throw new AppError("VALIDATION_ERROR", `A chunk must contain 1–${IMPORT_CHUNK_SIZE} rows.`);
    }

    const options: ImportOptions = {
      existing: job.options.existing === "update_blank" ? "update_blank" : "skip",
      checkMx: job.options.checkMx === true,
    };
    const report: ReportEntry[] = [];
    const note = (row: number, severity: ReportEntry["severity"], code: string, reason: string) =>
      report.push({ row, severity, code, reason });

    // --- MX (optional, batched per distinct domain) -------------------------------------------
    let mxByDomain = new Map<string, MxResult>();
    if (options.checkMx) {
      const domains = chunk.rows.flatMap((r) => {
        const email = normalizeEmail(r.data.email);
        return email && isValidEmailSyntax(email) ? [emailDomain(email)!] : [];
      });
      mxByDomain = await resolveDomains(deps.mx, domains);
    }

    // --- Validate, then in-chunk dedupe ---------------------------------------------------------
    let skipped = 0;
    let duplicate = 0;
    const valid: Valid[] = [];
    const seen = new Set<string>();

    for (const item of chunk.rows) {
      if (item.duplicateOf !== undefined) {
        duplicate++;
        note(item.row, "warning", "duplicate_in_file", `Duplicate of row ${item.duplicateOf} (same email) — not imported`);
        continue;
      }
      const email = normalizeEmail(item.data.email);
      const mx = email ? mxByDomain.get(emailDomain(email) ?? "") : undefined;
      const { lead, issues } = validateLeadInput(item.data, { mx });
      for (const issue of issues) note(item.row, issue.severity, issue.code, issue.message);
      if (!lead) {
        skipped++;
        continue;
      }
      const key = fallbackKey(lead);
      if (seen.has(key)) {
        duplicate++;
        note(item.row, "warning", "duplicate_in_file", "Duplicate of an earlier row in this file — not imported");
        continue;
      }
      seen.add(key);
      valid.push({ row: item.row, lead });
    }

    // --- Match existing leads --------------------------------------------------------------------
    const emails = valid.flatMap((v) => (v.lead.email ? [v.lead.email] : []));
    const [existing, dnc] = await Promise.all([
      repo.findExisting(ctx.workspaceId, {
        emails,
        linkedinSlugs: valid.flatMap((v) => {
          const s = linkedinSlug(v.lead.linkedinUrl);
          return s ? [s] : [];
        }),
        names: valid.filter((v) => !v.lead.email && !v.lead.linkedinUrl).map((v) => v.lead.fullName.toLowerCase()),
      }),
      repo.findDnc(ctx.workspaceId, emails),
    ]);
    const byEmail = new Map(existing.flatMap((e) => (e.emailKey ? [[e.emailKey, e] as const] : [])));
    const bySlug = new Map(existing.flatMap((e) => (e.linkedinSlug ? [[e.linkedinSlug, e] as const] : [])));
    const bareByName = existing.filter((e) => !e.emailKey && !e.linkedin_url);

    const claimedExisting = new Set<number>();
    const toInsert: Valid[] = [];
    const toFill: { v: Valid; existing: (typeof existing)[number] }[] = [];

    for (const v of valid) {
      const slug = linkedinSlug(v.lead.linkedinUrl);
      const match =
        (v.lead.email ? byEmail.get(v.lead.email) : undefined) ??
        (slug ? bySlug.get(slug) : undefined) ??
        (!v.lead.email && !slug
          ? bareByName.find((e) => e.nameKey === v.lead.fullName.toLowerCase() && normalizeCompanyName(e.company) === normalizeCompanyName(v.lead.company))
          : undefined);

      if (!match) {
        toInsert.push(v);
      } else if (claimedExisting.has(match.id)) {
        duplicate++;
        note(v.row, "warning", "duplicate_in_file", "Matches the same existing lead as an earlier row — not imported");
      } else {
        claimedExisting.add(match.id);
        toFill.push({ v, existing: match });
      }
    }

    // --- Companies (only for rows we will actually write) -----------------------------------------
    const fillCandidates = options.existing === "update_blank" ? toFill : [];
    const writeSet = [...toInsert, ...fillCandidates.map((f) => f.v)];
    const resolution = await deps.resolveCompanies(
      ctx,
      writeSet.map((w) => ({ name: w.lead.company, domain: w.lead.companyDomain })),
      "import",
    );
    const companyIdOf = new Map<Valid, number | null>(writeSet.map((w, i) => [w, resolution.companyIds[i]]));

    const inserts: { row: number; data: InsertRow }[] = toInsert.map((v) => ({
      row: v.row,
      data: {
        first_name: v.lead.firstName,
        last_name: v.lead.lastName,
        full_name: v.lead.fullName,
        email: v.lead.email,
        email_status: v.lead.emailStatus,
        company: v.lead.company,
        company_id: companyIdOf.get(v) ?? null,
        job_title: v.lead.jobTitle,
        linkedin_url: v.lead.linkedinUrl,
        phone: v.lead.phone,
        source_url: v.lead.sourceUrl,
      },
    }));

    const updates: { row: number; data: FillPatch }[] = [];
    for (const f of toFill) {
      if (options.existing === "skip") {
        duplicate++;
        note(f.v.row, "warning", "existing_skipped", "Already exists — skipped");
        continue;
      }
      const patch = computeFill(f.existing, f.v.lead, companyIdOf.get(f.v) ?? null);
      if (!patch) {
        duplicate++;
        note(f.v.row, "warning", "existing_no_change", "Already exists — nothing blank to fill");
      } else {
        updates.push({ row: f.v.row, data: patch });
      }
    }

    const blocked = toInsert.filter((v) => v.lead.email && dnc.has(v.lead.email));
    for (const v of blocked) {
      note(v.row, "warning", "do_not_contact", "Imported, but blocked from campaigns: this email is on your Do Not Contact list");
    }
    const risky = toInsert.filter((v) => v.lead.emailStatus === "risky").length;

    const progress: ProgressDelta = {
      index: chunk.index,
      processed: chunk.rows.length,
      duplicate,
      skipped,
      failed: 0,
      blocked: blocked.length,
      risky,
      report,
    };

    // --- Write: one atomic statement; per-row fallback isolates a poison row ------------------------
    try {
      const written = await repo.writeChunk(ctx.workspaceId, jobId, inserts.map((i) => i.data), updates.map((u) => u.data), progress);
      const insertedEmails = new Set(written.insertedEmails);
      const raced = inserts.filter((i) => i.data.email && !insertedEmails.has(i.data.email));
      if (raced.length > 0) {
        await repo.appendReport(
          ctx.workspaceId,
          jobId,
          raced.map((i) => ({ row: i.row, severity: "warning" as const, code: "existing_skipped", reason: "Already exists — created by a concurrent import" })),
        );
      }
    } catch (err) {
      log.warn("import.chunk_batch_failed", { job_id: jobId, chunk: chunk.index, err });
      let created = 0;
      let updated = 0;
      let attempted = 0;
      let failed = 0;
      const failures: ReportEntry[] = [];
      for (const ins of inserts) {
        try {
          const r = await repo.writeRows(ctx.workspaceId, [ins.data], []);
          created += r.created;
          attempted++;
        } catch (rowErr) {
          failed++;
          log.warn("import.row_failed", { job_id: jobId, row: ins.row, err: rowErr });
          failures.push({ row: ins.row, severity: "error", code: "save_failed", reason: "Could not save this row" });
        }
      }
      for (const upd of updates) {
        try {
          updated += (await repo.writeRows(ctx.workspaceId, [], [upd.data])).updated;
        } catch (rowErr) {
          failed++;
          log.warn("import.row_failed", { job_id: jobId, row: upd.row, err: rowErr });
          failures.push({ row: upd.row, severity: "error", code: "save_failed", reason: "Could not update this existing lead" });
        }
      }
      await repo.recordProgress(
        ctx.workspaceId,
        jobId,
        { ...progress, failed, report: [...report, ...failures] },
        { created, updated, insertsAttempted: attempted },
      );
    }

    const after = await loadJob(ctx, jobId);
    const outcome = after.chunk_results[String(chunk.index)];
    if (!outcome) {
      // The guarded counter update matched nothing: a concurrent delivery of the same chunk won.
      throw new AppError("CONFLICT", "This chunk is already being processed.");
    }
    return { outcome, job: toJobView(after), alreadyProcessed: false };
  }

  async function finish(ctx: ImportCtx, jobId: number): Promise<ImportJobView> {
    const job = await loadJob(ctx, jobId);
    if (job.status !== "running") return toJobView(job);
    const status =
      job.processed_rows < job.total_rows ? "interrupted" : job.failed_count > 0 ? "completed_with_errors" : "completed";
    const finished = await repo.finishJob(ctx.workspaceId, jobId, status);
    return toJobView(finished ?? job);
  }

  async function report(ctx: ImportCtx, jobId: number): Promise<{ job: ImportJobView; entries: ReportEntry[] }> {
    const job = await loadJob(ctx, jobId);
    return { job: toJobView(job), entries: await repo.getReport(ctx.workspaceId, jobId) };
  }

  /** Pre-commit lookup: which of these emails already exist / are on Do Not Contact. */
  async function lookupExisting(ctx: ImportCtx, rawEmails: string[]): Promise<{ existing: string[]; blocked: string[] }> {
    const emails = Array.from(new Set(rawEmails.map((e) => normalizeEmail(e)).filter((e): e is string => !!e))).slice(0, MAX_IMPORT_ROWS);
    const [existing, blocked] = await Promise.all([
      repo.findExistingEmails(ctx.workspaceId, emails),
      repo.findDnc(ctx.workspaceId, emails),
    ]);
    return { existing: [...existing], blocked: [...blocked] };
  }

  return { start, importChunk, finish, report, lookupExisting };
}

export const leadImportService = createLeadImportService({
  repo: sqlLeadImportRepository,
  resolveCompanies: companyService.resolveCompanies,
  mx: defaultMxResolver,
  log: createLogger({ scope: "lead-import" }),
});
