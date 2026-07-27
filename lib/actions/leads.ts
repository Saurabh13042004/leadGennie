"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { extractCriteriaWithAi } from "@/lib/ai/filter";
import { GeminiError } from "@/lib/ai/gemini";
import { requireRole } from "@/lib/auth/workspace-context";
import {
  countMatchingLeads,
  extractCriteriaRegex,
  hashToRange,
  hasStructuredCriteria,
  matchKnownCompanies,
  type FilterCriteria,
} from "@/lib/db/lead-matching";

export type Lead = {
  id: number;
  full_name: string;
  email: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  stage: string;
  source: string;
  created_at: string;
};

export async function listLeads(): Promise<Lead[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, full_name, email, company, job_title, linkedin_url, stage, source, created_at
    from leads
    where workspace_id = ${workspaceId}
    order by created_at desc
    limit 500
  `;
  return rows as Lead[];
}

export type ImportRow = {
  full_name: string;
  email?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
};

export type ImportError = { row: number; reason: string };

export type ImportResult = {
  total: number;
  created: number;
  updated: number;
  duplicate: number;
  skipped: number;
  failed: number;
  errors: ImportError[];
  jobId: number;
};

type PendingRow = { row: ImportRow & { full_name: string; email?: string }; originalIndex: number };

const UPSERT_SQL = `
  insert into leads (workspace_id, owner_email, full_name, email, company, job_title, linkedin_url, source)
  select * from unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::text[])
  on conflict (workspace_id, lower(email)) where email is not null do update set
    full_name = excluded.full_name,
    company = coalesce(excluded.company, leads.company),
    job_title = coalesce(excluded.job_title, leads.job_title),
    linkedin_url = coalesce(excluded.linkedin_url, leads.linkedin_url)
  returning (xmax = 0) as inserted
`;

function upsertParams(workspaceId: number, owner: string, rows: PendingRow["row"][]) {
  return [
    rows.map(() => workspaceId),
    rows.map(() => owner),
    rows.map((r) => r.full_name),
    rows.map((r) => r.email?.trim() || null),
    rows.map((r) => r.company?.trim() || null),
    rows.map((r) => r.job_title?.trim() || null),
    rows.map((r) => r.linkedin_url?.trim() || null),
    rows.map(() => "csv"),
  ];
}

async function upsertLeadRow(
  workspaceId: number,
  owner: string,
  row: PendingRow["row"]
): Promise<{ inserted: boolean }> {
  const result = await sql.query(UPSERT_SQL, upsertParams(workspaceId, owner, [row]));
  return { inserted: result[0].inserted as boolean };
}

/**
 * Idempotent, resumable CSV import (CRM-03): safe to re-run the same file —
 * rows are matched by (workspace, email) and upserted rather than duplicated.
 * Every row is accounted for as created/updated/duplicate/skipped/failed and
 * the run is persisted to import_jobs for audit and to support re-upload.
 */
export async function importLeadsCsv(rows: ImportRow[], fileName?: string): Promise<ImportResult> {
  const { workspaceId, email: owner, userId } = await requireRole("member");

  const errors: ImportError[] = [];
  let skipped = 0;
  let duplicate = 0;
  let created = 0;
  let updated = 0;
  let failed = 0;

  const seenEmails = new Map<string, number>();
  const pending: PendingRow[] = [];

  rows.forEach((r, idx) => {
    const fullName = r.full_name?.trim();
    if (!fullName) {
      skipped++;
      errors.push({ row: idx + 1, reason: "Missing full name" });
      return;
    }
    const email = r.email?.trim().toLowerCase();
    if (email) {
      const firstSeenAt = seenEmails.get(email);
      if (firstSeenAt !== undefined) {
        duplicate++;
        errors.push({ row: idx + 1, reason: `Duplicate email — already seen at row ${firstSeenAt + 1}` });
        return;
      }
      seenEmails.set(email, idx);
    }
    pending.push({ row: { ...r, full_name: fullName }, originalIndex: idx });
  });

  // Try the whole batch as one upsert (fast path). If anything in the batch
  // throws, Postgres rolls the whole statement back — fall back to row-by-row
  // so a single bad row can't block the rest, and so failures are attributable.
  if (pending.length > 0) {
    try {
      const result = await sql.query(
        UPSERT_SQL,
        upsertParams(workspaceId, owner, pending.map((p) => p.row))
      );
      for (const r of result) {
        if (r.inserted) created++;
        else updated++;
      }
    } catch {
      for (const p of pending) {
        try {
          const { inserted } = await upsertLeadRow(workspaceId, owner, p.row);
          if (inserted) created++;
          else updated++;
        } catch (err) {
          failed++;
          errors.push({ row: p.originalIndex + 1, reason: err instanceof Error ? err.message : "Insert failed" });
        }
      }
    }
  }

  const jobInserted = await sql`
    insert into import_jobs (
      workspace_id, source, file_name, total_rows, created_count, updated_count,
      duplicate_count, skipped_count, failed_count, error_report, status, created_by_user_id
    )
    values (
      ${workspaceId}, 'csv', ${fileName ?? null}, ${rows.length}, ${created}, ${updated},
      ${duplicate}, ${skipped}, ${failed}, ${JSON.stringify(errors)},
      ${failed > 0 ? "completed_with_errors" : "completed"}, ${userId}
    )
    returning id
  `;

  revalidatePath("/dashboard/leads");

  return {
    total: rows.length,
    created,
    updated,
    duplicate,
    skipped,
    failed,
    errors,
    jobId: jobInserted[0].id as number,
  };
}

export type EstimateMethod = "measured" | "no_matches" | "guessed";

export type AiFilterResult = {
  id: number;
  name: string;
  criteria: FilterCriteria;
  estimatedCount: number;
  estimateMethod: EstimateMethod;
};

export async function generateAiFilter(prompt: string): Promise<AiFilterResult> {
  const { workspaceId, email: owner } = await requireRole("member");
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is required");

  let criteria: FilterCriteria;
  try {
    criteria = await extractCriteriaWithAi(trimmed);
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    criteria = extractCriteriaRegex(trimmed);
  }

  // Ground-truth check against real data, regardless of which extraction path
  // ran above — catches a company name (e.g. "dice solutions") that neither
  // the AI nor the regex fallback recognized as one, but that already exists
  // in this workspace's leads.
  const knownCompanyMatches = await matchKnownCompanies(workspaceId, trimmed);
  if (knownCompanyMatches.length > 0) {
    criteria = {
      ...criteria,
      companies: Array.from(new Set([...criteria.companies, ...knownCompanyMatches])),
    };
  }

  const matchedCount = await countMatchingLeads(workspaceId, criteria);
  // DAS-01: never present a fabricated number as if it were observed — every
  // caller gets `estimateMethod` alongside the count so the UI can label it.
  const estimateMethod: EstimateMethod =
    matchedCount > 0 ? "measured" : hasStructuredCriteria(criteria) ? "no_matches" : "guessed";
  const estimatedCount =
    matchedCount > 0 ? matchedCount : estimateMethod === "no_matches" ? 0 : hashToRange(trimmed, 150, 2200);

  const name = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;

  const inserted = await sql`
    insert into segments (workspace_id, owner_email, name, prompt, criteria, lead_count)
    values (${workspaceId}, ${owner}, ${name}, ${trimmed}, ${JSON.stringify(criteria)}, ${estimatedCount})
    returning id
  `;

  revalidatePath("/dashboard/leads");

  return {
    id: inserted[0].id as number,
    name,
    criteria,
    estimatedCount,
    estimateMethod,
  };
}
