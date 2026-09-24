import { sql } from "@/lib/db/client";
import type { ExistingLeadState, FillPatch } from "@/lib/domain/leads/import/merge";

/**
 * SQL for the import pipeline. Everything is workspace-scoped. A chunk is
 * written as ONE statement (data-modifying CTEs), which Postgres executes
 * atomically — so a chunk either lands completely, progress counters included,
 * or not at all, without needing an interactive transaction over Neon's HTTP driver.
 */

export const ERROR_REPORT_CAP = 5000;

export type ReportEntry = { row: number; severity: "error" | "warning"; code: string; reason: string };

export type ChunkOutcome = {
  index: number;
  processed: number;
  created: number;
  updated: number;
  duplicate: number;
  skipped: number;
  failed: number;
  blocked: number;
  risky: number;
};

export type ImportJobRow = {
  id: number;
  status: string;
  file_name: string | null;
  total_rows: number;
  processed_rows: number;
  created_count: number;
  updated_count: number;
  duplicate_count: number;
  skipped_count: number;
  failed_count: number;
  blocked_count: number;
  risky_count: number;
  options: { existing?: string; checkMx?: boolean };
  chunk_results: Record<string, ChunkOutcome>;
  finished_at: string | null;
  created_at: string;
};

const JOB_COLUMNS = `id, status, file_name, total_rows, processed_rows, created_count, updated_count, duplicate_count,
  skipped_count, failed_count, blocked_count, risky_count, options, chunk_results, finished_at, created_at`;

function toJob(r: Record<string, unknown>): ImportJobRow {
  const n = (k: string) => Number(r[k] ?? 0);
  return {
    id: n("id"),
    status: r.status as string,
    file_name: (r.file_name as string | null) ?? null,
    total_rows: n("total_rows"),
    processed_rows: n("processed_rows"),
    created_count: n("created_count"),
    updated_count: n("updated_count"),
    duplicate_count: n("duplicate_count"),
    skipped_count: n("skipped_count"),
    failed_count: n("failed_count"),
    blocked_count: n("blocked_count"),
    risky_count: n("risky_count"),
    options: (r.options as ImportJobRow["options"]) ?? {},
    chunk_results: (r.chunk_results as ImportJobRow["chunk_results"]) ?? {},
    finished_at: (r.finished_at as string | null) ?? null,
    created_at: r.created_at as string,
  };
}

export async function createImportJob(
  workspaceId: number,
  userId: number,
  input: { fileName: string | null; totalRows: number; options: object; idempotencyKey: string | null },
): Promise<ImportJobRow> {
  const rows = await sql.query(
    `insert into import_jobs (workspace_id, source, file_name, total_rows, status, options, idempotency_key, created_by_user_id)
     values ($1, 'csv', $2, $3, 'running', $4::jsonb, $5, $6)
     on conflict (workspace_id, idempotency_key) where idempotency_key is not null do nothing
     returning ${JOB_COLUMNS}`,
    [workspaceId, input.fileName, input.totalRows, JSON.stringify(input.options), input.idempotencyKey, userId],
  );
  if (rows[0]) return toJob(rows[0]);
  // Retried start with the same key → the existing job.
  const existing = await sql.query(
    `select ${JOB_COLUMNS} from import_jobs where workspace_id = $1 and idempotency_key = $2`,
    [workspaceId, input.idempotencyKey],
  );
  return toJob(existing[0]);
}

export async function getImportJob(workspaceId: number, id: number): Promise<ImportJobRow | null> {
  const rows = await sql.query(`select ${JOB_COLUMNS} from import_jobs where id = $1 and workspace_id = $2`, [id, workspaceId]);
  return rows[0] ? toJob(rows[0]) : null;
}

export async function getImportErrorReport(workspaceId: number, id: number): Promise<ReportEntry[]> {
  const rows = await sql`select error_report from import_jobs where id = ${id} and workspace_id = ${workspaceId}`;
  return ((rows[0]?.error_report as ReportEntry[] | undefined) ?? []) as ReportEntry[];
}

export async function appendErrorReport(workspaceId: number, id: number, entries: ReportEntry[]): Promise<void> {
  if (entries.length === 0) return;
  await sql.query(
    `update import_jobs j set
       error_report = case
         when jsonb_array_length(j.error_report) >= ${ERROR_REPORT_CAP} then j.error_report
         else (select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
               from jsonb_array_elements(j.error_report || $3::jsonb) with ordinality as t(e, n)
               where n <= ${ERROR_REPORT_CAP})
       end,
       updated_at = now()
     where j.id = $1 and j.workspace_id = $2`,
    [id, workspaceId, JSON.stringify(entries)],
  );
}

export async function finishImportJob(workspaceId: number, id: number, status: string): Promise<ImportJobRow | null> {
  const rows = await sql.query(
    `update import_jobs set status = $3, finished_at = now(), updated_at = now()
     where id = $1 and workspace_id = $2 and status = 'running'
     returning ${JOB_COLUMNS}`,
    [id, workspaceId, status],
  );
  return rows[0] ? toJob(rows[0]) : getImportJob(workspaceId, id);
}

// ---------------------------------------------------------------------------
// Reads used to classify a chunk
// ---------------------------------------------------------------------------

export type ExistingLeadRow = ExistingLeadState & {
  full_name: string;
  emailKey: string | null;
  linkedinSlug: string | null;
  nameKey: string;
};

const SLUG_EXPR = `substring(lower(linkedin_url) from 'linkedin\\.com/(?:in|pub)/([^/?#]+)')`;

/** Existing leads that could be the same person as any of the chunk's rows. */
export async function findExistingLeads(
  workspaceId: number,
  keys: { emails: string[]; linkedinSlugs: string[]; names: string[] },
): Promise<ExistingLeadRow[]> {
  if (keys.emails.length + keys.linkedinSlugs.length + keys.names.length === 0) return [];
  const rows = await sql.query(
    `select id, email, lower(email) as email_key, first_name, last_name, phone, job_title, company, company_id,
            linkedin_url, ${SLUG_EXPR} as linkedin_slug, source_url, full_name, lower(full_name) as name_key
     from leads
     where workspace_id = $1
       and ( lower(email) = any($2::text[])
          or ${SLUG_EXPR} = any($3::text[])
          or (email is null and linkedin_url is null and lower(full_name) = any($4::text[])) )`,
    [workspaceId, keys.emails, keys.linkedinSlugs, keys.names],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    email: (r.email as string | null) ?? null,
    emailKey: (r.email_key as string | null) ?? null,
    first_name: (r.first_name as string | null) ?? null,
    last_name: (r.last_name as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    job_title: (r.job_title as string | null) ?? null,
    company: (r.company as string | null) ?? null,
    company_id: r.company_id === null || r.company_id === undefined ? null : Number(r.company_id),
    linkedin_url: (r.linkedin_url as string | null) ?? null,
    linkedinSlug: (r.linkedin_slug as string | null) ?? null,
    source_url: (r.source_url as string | null) ?? null,
    full_name: r.full_name as string,
    nameKey: r.name_key as string,
  }));
}

/** Which of these emails are on the workspace's Do Not Contact list (lowercase). */
export async function findDncEmails(workspaceId: number, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await sql.query(
    `select lower(email) as email from do_not_contact where workspace_id = $1 and lower(email) = any($2::text[])`,
    [workspaceId, emails],
  );
  return new Set(rows.map((r) => r.email as string));
}

/** Which of these emails already belong to a lead (lowercase) — for the pre-commit preview. */
export async function findExistingEmails(workspaceId: number, emails: string[]): Promise<Set<string>> {
  if (emails.length === 0) return new Set();
  const rows = await sql.query(
    `select lower(email) as email from leads where workspace_id = $1 and lower(email) = any($2::text[])`,
    [workspaceId, emails],
  );
  return new Set(rows.map((r) => r.email as string));
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export type InsertRow = {
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  email: string | null;
  email_status: string;
  company: string | null;
  company_id: number | null;
  job_title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  source_url: string | null;
};

const INSERT_COLS = [
  ["first_name", "text"], ["last_name", "text"], ["full_name", "text"], ["email", "text"], ["email_status", "text"],
  ["company", "text"], ["company_id", "bigint"], ["job_title", "text"], ["linkedin_url", "text"], ["phone", "text"], ["source_url", "text"],
] as const satisfies readonly (readonly [keyof InsertRow, string])[];

const UPDATE_COLS = [
  ["first_name", "text"], ["last_name", "text"], ["phone", "text"], ["job_title", "text"], ["company", "text"],
  ["company_id", "bigint"], ["linkedin_url", "text"], ["source_url", "text"], ["email", "text"], ["email_status", "text"],
] as const satisfies readonly (readonly [keyof FillPatch, string])[];

export type ProgressDelta = {
  index: number;
  processed: number;
  duplicate: number;
  skipped: number;
  failed: number;
  blocked: number;
  risky: number;
  report: ReportEntry[];
};

export type RowWriteResult = { created: number; updated: number; insertedEmails: string[] };

/**
 * Builds the CTE. `progress` present ⇒ the same statement also bumps the job's
 * counters, records this chunk's outcome under its index (making a re-delivery a
 * no-op) and appends to the capped error report — all atomically with the rows.
 */
function buildWrite(
  workspaceId: number,
  jobId: number,
  inserts: InsertRow[],
  updates: FillPatch[],
  progress: ProgressDelta | null,
) {
  const params: unknown[] = [workspaceId];
  const arg = (v: unknown, cast: string) => {
    params.push(v);
    return `$${params.length}::${cast}[]`;
  };

  const insArgs = INSERT_COLS.map(([col, type]) => arg(inserts.map((r) => r[col]), type));
  const updArgs = [
    arg(updates.map((u) => u.id), "bigint"),
    ...UPDATE_COLS.map(([col, type]) => arg(updates.map((u) => u[col]), type)),
  ];

  const blankOr = (col: string) => `case when nullif(l.${col}::text, '') is null then v.${col} else l.${col} end`;
  const ctes = [
    `ins as (
       insert into leads (workspace_id, ${INSERT_COLS.map(([c]) => c).join(", ")}, source)
       select $1::bigint, ${INSERT_COLS.map(([c]) => `t.${c}`).join(", ")}, 'csv'
       from unnest(${insArgs.join(", ")}) as t(${INSERT_COLS.map(([c]) => c).join(", ")})
       on conflict (workspace_id, lower(email)) where email is not null do nothing
       returning id, lower(email) as email
     )`,
    `upd as (
       update leads l set
         ${UPDATE_COLS.filter(([c]) => c !== "email_status")
           .map(([c]) => `${c} = ${blankOr(c)}`)
           .join(",\n         ")},
         email_status = case when nullif(l.email, '') is null and v.email is not null then v.email_status else l.email_status end,
         updated_at = now()
       from unnest(${updArgs.join(", ")}) as v(id, ${UPDATE_COLS.map(([c]) => c).join(", ")})
       where l.id = v.id and l.workspace_id = $1::bigint
       returning l.id
     )`,
  ];

  if (progress) {
    params.push(jobId, String(progress.index), progress.processed, progress.duplicate, progress.skipped, progress.failed,
      progress.blocked, progress.risky, inserts.length, JSON.stringify(progress.report));
    const p = (offset: number) => `$${params.length - 9 + offset}`;
    const [jobP, idxP, procP, dupP, skipP, failP, blockP, riskP, insLenP, reportP] = [p(0), p(1), p(2), p(3), p(4), p(5), p(6), p(7), p(8), p(9)];
    ctes.push(`bump as (
       update import_jobs j set
         processed_rows = j.processed_rows + ${procP}::int,
         created_count = j.created_count + (select count(*) from ins),
         updated_count = j.updated_count + (select count(*) from upd),
         duplicate_count = j.duplicate_count + ${dupP}::int + (${insLenP}::int - (select count(*) from ins)),
         skipped_count = j.skipped_count + ${skipP}::int,
         failed_count = j.failed_count + ${failP}::int,
         blocked_count = j.blocked_count + ${blockP}::int,
         risky_count = j.risky_count + ${riskP}::int,
         chunk_results = j.chunk_results || jsonb_build_object(${idxP}::text, jsonb_build_object(
           'index', ${idxP}::text::int, 'processed', ${procP}::int,
           'created', (select count(*) from ins), 'updated', (select count(*) from upd),
           'duplicate', ${dupP}::int + (${insLenP}::int - (select count(*) from ins)),
           'skipped', ${skipP}::int, 'failed', ${failP}::int, 'blocked', ${blockP}::int, 'risky', ${riskP}::int)),
         error_report = case
           when jsonb_array_length(j.error_report) >= ${ERROR_REPORT_CAP} then j.error_report
           else (select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
                 from jsonb_array_elements(j.error_report || ${reportP}::jsonb) with ordinality as t(e, n)
                 where n <= ${ERROR_REPORT_CAP})
         end,
         updated_at = now()
       where j.id = ${jobP}::bigint and j.workspace_id = $1::bigint and not (j.chunk_results ? ${idxP}::text)
       returning 1
     )`);
  }

  const text = `with ${ctes.join(",\n")}
    select (select count(*)::int from ins) as created,
           (select count(*)::int from upd) as updated,
           (select coalesce(array_agg(email), '{}'::text[]) from ins) as inserted_emails
           ${progress ? ", (select count(*)::int from bump) as bumped" : ""}`;
  return { text, params };
}

async function runWrite(built: { text: string; params: unknown[] }): Promise<RowWriteResult> {
  const rows = await sql.query(built.text, built.params);
  const r = rows[0];
  return {
    created: Number(r.created),
    updated: Number(r.updated),
    insertedEmails: ((r.inserted_emails as (string | null)[]) ?? []).filter((e): e is string => !!e),
  };
}

/** Happy path: rows + progress in one atomic statement. */
export function writeChunk(workspaceId: number, jobId: number, inserts: InsertRow[], updates: FillPatch[], progress: ProgressDelta) {
  return runWrite(buildWrite(workspaceId, jobId, inserts, updates, progress));
}

/** Fallback path: rows only (no progress), so one poison row can be isolated. */
export function writeRows(workspaceId: number, inserts: InsertRow[], updates: FillPatch[]) {
  return runWrite(buildWrite(workspaceId, 0, inserts, updates, null));
}

/** Fallback path: record a chunk's outcome after its rows were written individually. */
export async function recordChunkProgress(
  workspaceId: number,
  jobId: number,
  progress: ProgressDelta,
  written: { created: number; updated: number; insertsAttempted: number },
): Promise<void> {
  await sql.query(
    `update import_jobs j set
       processed_rows = j.processed_rows + $3::int,
       created_count = j.created_count + $4::int,
       updated_count = j.updated_count + $5::int,
       duplicate_count = j.duplicate_count + $6::int,
       skipped_count = j.skipped_count + $7::int,
       failed_count = j.failed_count + $8::int,
       blocked_count = j.blocked_count + $9::int,
       risky_count = j.risky_count + $10::int,
       chunk_results = j.chunk_results || jsonb_build_object($11::text, jsonb_build_object(
         'index', $11::text::int, 'processed', $3::int, 'created', $4::int, 'updated', $5::int, 'duplicate', $6::int,
         'skipped', $7::int, 'failed', $8::int, 'blocked', $9::int, 'risky', $10::int)),
       error_report = case
         when jsonb_array_length(j.error_report) >= ${ERROR_REPORT_CAP} then j.error_report
         else (select coalesce(jsonb_agg(e order by n), '[]'::jsonb)
               from jsonb_array_elements(j.error_report || $12::jsonb) with ordinality as t(e, n)
               where n <= ${ERROR_REPORT_CAP})
       end,
       updated_at = now()
     where j.id = $1 and j.workspace_id = $2 and not (j.chunk_results ? $11::text)`,
    [jobId, workspaceId, progress.processed, written.created, written.updated, progress.duplicate + (written.insertsAttempted - written.created),
      progress.skipped, progress.failed, progress.blocked, progress.risky, String(progress.index), JSON.stringify(progress.report)],
  );
}
