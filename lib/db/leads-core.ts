import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";

/**
 * Plain (non-"use server") shared core for creating/updating a lead —
 * imported by both the session-authenticated dashboard actions
 * (lib/actions/leads.ts) and token-authenticated extension routes
 * (app/api/extension/leads/route.ts), so the two auth paths can never drift
 * into different validation/dedupe behavior.
 */

export type LeadRecord = {
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

export type LeadFields = {
  full_name: string;
  email?: string | null;
  company?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  stage?: string | null;
};

function normalizeLeadFields(input: LeadFields) {
  const full_name = input.full_name.trim();
  if (!full_name) throw new AppError("VALIDATION_ERROR", "Full name is required.");
  return {
    full_name,
    email: input.email?.trim() || null,
    company: input.company?.trim() || null,
    job_title: input.job_title?.trim() || null,
    linkedin_url: input.linkedin_url?.trim() || null,
    stage: input.stage?.trim() || "new",
  };
}

export async function assertLeadEmailAvailable(workspaceId: number, email: string | null, excludeId?: number) {
  if (!email) return;
  const rows = excludeId
    ? await sql`
        select id from leads
        where workspace_id = ${workspaceId} and lower(email) = lower(${email}) and id != ${excludeId}
      `
    : await sql`select id from leads where workspace_id = ${workspaceId} and lower(email) = lower(${email})`;
  if (rows.length > 0) throw new AppError("CONFLICT", "A lead with this email already exists.");
}

export async function insertLead(
  workspaceId: number,
  input: LeadFields,
  source: string
): Promise<LeadRecord> {
  const v = normalizeLeadFields(input);
  await assertLeadEmailAvailable(workspaceId, v.email);

  const inserted = await sql`
    insert into leads (workspace_id, full_name, email, company, job_title, linkedin_url, stage, source)
    values (${workspaceId}, ${v.full_name}, ${v.email}, ${v.company}, ${v.job_title}, ${v.linkedin_url}, ${v.stage}, ${source})
    returning id, full_name, email, company, job_title, linkedin_url, stage, source, created_at
  `;
  return inserted[0] as LeadRecord;
}

export async function updateLeadFields(workspaceId: number, id: number, input: LeadFields): Promise<LeadRecord> {
  const v = normalizeLeadFields(input);
  await assertLeadEmailAvailable(workspaceId, v.email, id);

  const updated = await sql`
    update leads set
      full_name = ${v.full_name},
      email = ${v.email},
      company = ${v.company},
      job_title = ${v.job_title},
      linkedin_url = ${v.linkedin_url},
      stage = ${v.stage}
    where id = ${id} and workspace_id = ${workspaceId}
    returning id, full_name, email, company, job_title, linkedin_url, stage, source, created_at
  `;
  if (updated.length === 0) throw new AppError("NOT_FOUND", "Lead not found");
  return updated[0] as LeadRecord;
}
