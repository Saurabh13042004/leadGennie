"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { extractCriteriaWithAi } from "@/lib/ai/filter";
import { LlmError } from "@/lib/ai/client";
import { requireRole } from "@/lib/auth/workspace-context";
import {
  countMatchingLeads,
  extractCriteriaRegex,
  hasStructuredCriteria,
  matchKnownCompanies,
  normalize as normalizeCriteria,
  type FilterCriteria,
} from "@/lib/db/lead-matching";
import { insertLead, updateLeadFields } from "@/lib/db/leads-core";
import { listLeadsPage, getLeadDetail, type LeadDetail, type LeadListPage } from "@/lib/db/leads-list";
import { parseLeadListParams, type LeadListQuery, type RawSearchParams } from "@/lib/domain/leads/list-query";
import { leadImportService } from "@/lib/domain/leads/import/service";
import { DEFAULT_IMPORT_OPTIONS, IMPORT_CHUNK_SIZE } from "@/lib/domain/leads/import/preview";
import { logActivity } from "@/lib/activity";

export type Lead = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_status: string;
  company: string | null;
  company_id: number | null;
  job_title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  stage: string;
  source: string;
  created_at: string;
};

/** Up to 500 most recent leads, for pickers (Deals, Inbound matching). The Leads page uses getLeadsPage. */
export async function listLeads(): Promise<Lead[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, full_name, first_name, last_name, email, email_status, company, company_id, job_title,
           linkedin_url, phone, stage, source, created_at
    from leads
    where workspace_id = ${workspaceId}
    order by created_at desc
    limit 500
  `;
  return rows.map((r) => ({
    ...(r as unknown as Lead),
    id: Number(r.id),
    company_id: r.company_id === null ? null : Number(r.company_id),
  }));
}

export type LeadInput = {
  full_name: string;
  email?: string;
  company?: string;
  company_domain?: string;
  job_title?: string;
  linkedin_url?: string;
  phone?: string;
  stage?: string;
};

export async function createLead(input: LeadInput): Promise<Lead> {
  const { workspaceId, userId } = await requireRole("member");
  const lead = await insertLead(workspaceId, input, "manual");
  await logActivity({
    workspaceId, actorUserId: userId, type: "lead.created", entityType: "lead", entityId: lead.id,
    summary: `Added lead ${lead.full_name}`,
  });
  revalidatePath("/dashboard/leads");
  return lead;
}

export async function updateLead(id: number, input: LeadInput): Promise<Lead> {
  const { workspaceId, userId } = await requireRole("member");
  const lead = await updateLeadFields(workspaceId, id, input);
  await logActivity({
    workspaceId, actorUserId: userId, type: "lead.updated", entityType: "lead", entityId: lead.id,
    summary: `Updated lead ${lead.full_name}`,
  });
  revalidatePath("/dashboard/leads");
  return lead;
}

/** Server-side paginated lead list (page size 50). `sp` is the raw URL search params. */
export async function getLeadsPage(sp: RawSearchParams): Promise<{ query: LeadListQuery; page: LeadListPage }> {
  const { workspaceId } = await requireRole("viewer");
  const query = parseLeadListParams(sp);
  return { query, page: await listLeadsPage(workspaceId, query) };
}

export async function getLead(id: number): Promise<LeadDetail | null> {
  const { workspaceId } = await requireRole("viewer");
  if (!Number.isInteger(id) || id < 1) return null;
  return getLeadDetail(workspaceId, id);
}

/**
 * Deleting a lead cascades to delete its campaign_sends rows (see db/migrations/0001_baseline.sql),
 * which would silently erase the record that they were ever emailed — the
 * exact history compliance tooling (cooldown, DNC audits) relies on. Block
 * deletion once that history exists; Do Not Contact is the right tool for
 * "stop contacting this person" instead.
 */
export async function deleteLead(id: number): Promise<void> {
  const { workspaceId, userId } = await requireRole("admin");

  const leadRows = await sql`select id from leads where id = ${id} and workspace_id = ${workspaceId}`;
  if (leadRows.length === 0) throw new Error("Lead not found");

  const sendCount = await sql`select count(*)::int as count from campaign_sends where lead_id = ${id} and workspace_id = ${workspaceId}`;
  if ((sendCount[0].count as number) > 0) {
    throw new Error(
      "This lead has message history and can't be deleted — add them to Do Not Contact instead if you want to stop contacting them."
    );
  }

  await sql`delete from leads where id = ${id} and workspace_id = ${workspaceId}`;
  await logActivity({
    workspaceId, actorUserId: userId, type: "lead.deleted", entityType: "lead", entityId: null,
    summary: "Deleted a lead", metadata: { lead_id: id },
  });
  revalidatePath("/dashboard/leads");
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

/**
 * @deprecated Compatibility wrapper. The import UI uses the chunked pipeline in
 * lib/actions/lead-import.ts (start → chunks → finish); this runs the same
 * pipeline in one call for programmatic callers. Existing leads have only their
 * BLANK fields filled — a re-import never overwrites values (unlike the old upsert).
 */
export async function importLeadsCsv(rows: ImportRow[], fileName?: string): Promise<ImportResult> {
  const ctx = await requireRole("member");
  const job = await leadImportService.start(ctx, {
    fileName: fileName ?? null,
    totalRows: rows.length,
    options: { ...DEFAULT_IMPORT_OPTIONS, existing: "update_blank" },
  });
  for (let i = 0; i * IMPORT_CHUNK_SIZE < rows.length; i++) {
    const slice = rows.slice(i * IMPORT_CHUNK_SIZE, (i + 1) * IMPORT_CHUNK_SIZE);
    await leadImportService.importChunk(ctx, job.id, {
      index: i,
      // Legacy contract: row numbers are 1-based data rows (the UI pipeline uses spreadsheet rows, header = 1).
      rows: slice.map((r, j) => ({ row: i * IMPORT_CHUNK_SIZE + j + 1, data: r })),
    });
  }
  const done = await leadImportService.finish(ctx, job.id);
  const { entries } = await leadImportService.report(ctx, job.id);
  revalidatePath("/dashboard/leads");
  return {
    total: done.totalRows,
    created: done.created,
    updated: done.updated,
    duplicate: done.duplicate,
    skipped: done.skipped,
    failed: done.failed,
    errors: entries.filter((e) => e.severity === "error" || e.code.startsWith("duplicate")).map((e) => ({ row: e.row, reason: e.reason })),
    jobId: job.id,
  };
}

export type EstimateMethod = "measured" | "no_matches" | "unmeasurable";

export type AiFilterResult = {
  id: number;
  name: string;
  criteria: FilterCriteria;
  estimatedCount: number;
  estimateMethod: EstimateMethod;
};

export async function generateAiFilter(prompt: string): Promise<AiFilterResult> {
  const { workspaceId } = await requireRole("member");
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is required");

  let criteria: FilterCriteria;
  try {
    criteria = await extractCriteriaWithAi(trimmed);
  } catch (error) {
    if (!(error instanceof LlmError)) throw error;
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
    matchedCount > 0 ? "measured" : hasStructuredCriteria(criteria) ? "no_matches" : "unmeasurable";
  // No structured filter → nothing to count against real data, so report 0 and
  // let `estimateMethod: "unmeasurable"` say so. Never invent a number.
  const estimatedCount = matchedCount;

  const name = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;

  const inserted = await sql`
    insert into segments (workspace_id, name, prompt, criteria, lead_count)
    values (${workspaceId}, ${name}, ${trimmed}, ${JSON.stringify(criteria)}, ${estimatedCount})
    returning id
  `;

  revalidatePath("/dashboard/lead-lists");

  return {
    id: inserted[0].id as number,
    name,
    criteria,
    estimatedCount,
    estimateMethod,
  };
}

export type SegmentSummary = {
  id: number;
  name: string;
  prompt: string | null;
  criteria: FilterCriteria;
  leadCount: number;
  estimateMethod: EstimateMethod;
  createdAt: string;
};

/**
 * Recomputes each saved audience's count live against current leads rather
 * than trusting the `lead_count` stored at creation time — segments saved
 * before the company-matching fix (see matchKnownCompanies) had no way to
 * recognize a literal company name, so their stored count could be a
 * fabricated guess. Re-running the same ground-truth match here means old
 * segments self-correct on every view instead of staying wrong forever.
 */
export async function listSegments(): Promise<SegmentSummary[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select id, name, prompt, criteria, created_at
    from segments
    where workspace_id = ${workspaceId}
    order by created_at desc
  `;

  const segments: SegmentSummary[] = [];
  for (const r of rows) {
    let criteria = normalizeCriteria(r.criteria as FilterCriteria);
    const prompt = r.prompt as string | null;
    if (prompt) {
      const knownCompanyMatches = await matchKnownCompanies(workspaceId, prompt);
      if (knownCompanyMatches.length > 0) {
        criteria = {
          ...criteria,
          companies: Array.from(new Set([...(criteria.companies ?? []), ...knownCompanyMatches])),
        };
      }
    }
    const matchedCount = await countMatchingLeads(workspaceId, criteria);
    const estimateMethod: EstimateMethod =
      matchedCount > 0 ? "measured" : hasStructuredCriteria(criteria) ? "no_matches" : "unmeasurable";

    segments.push({
      id: r.id as number,
      name: r.name as string,
      prompt,
      criteria,
      leadCount: matchedCount,
      estimateMethod,
      createdAt: r.created_at as string,
    });
  }
  return segments;
}

export async function deleteSegment(id: number): Promise<void> {
  const { workspaceId } = await requireRole("member");
  const rows = await sql`delete from segments where id = ${id} and workspace_id = ${workspaceId} returning id`;
  if (rows.length === 0) throw new Error("Audience not found");
  revalidatePath("/dashboard/lead-lists");
}
