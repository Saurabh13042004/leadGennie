import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { matchOrCreateCompany, type CompanySource } from "@/lib/domain/companies/service";
import { classifyEmail } from "@/lib/domain/leads/email";
import { validateLeadInput, type LeadInput, type NormalizedLead } from "@/lib/domain/leads/validate";

/**
 * Plain (non-"use server") shared core for creating/updating a lead —
 * imported by both the session-authenticated dashboard actions
 * (lib/actions/leads.ts) and token-authenticated extension routes
 * (app/api/extension/leads/route.ts), so the two auth paths can never drift
 * into different validation/dedupe behavior. Field rules live in
 * lib/domain/leads/validate.ts, shared with the CSV import.
 */

export type LeadRecord = {
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

export type LeadFields = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  company?: string | null;
  company_domain?: string | null;
  job_title?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  source_url?: string | null;
  stage?: string | null;
};

const RETURNING = `id, full_name, first_name, last_name, email, email_status, company, company_id, job_title,
  linkedin_url, phone, stage, source, created_at`;

/**
 * Manual entry is strict: anything we would silently drop (a bad LinkedIn URL or
 * domain) is an error the user can fix. Machine sources (extension, imports)
 * import what is valid and warn about the rest.
 */
function validateOrThrow(input: LeadFields, strict: boolean): NormalizedLead {
  const { lead, issues } = validateLeadInput(input as LeadInput);
  const blocking = issues.filter((i) => i.severity === "error" || (strict && (i.code === "invalid_linkedin_url" || i.code === "invalid_company_domain")));
  if (!lead || blocking.length > 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      blocking[0]?.message ?? "Invalid lead.",
      blocking.map((b) => ({ path: b.field, message: b.message })),
    );
  }
  return lead;
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

/** Neon returns bigint columns as strings; the rest of the app (and the client) expects numbers. */
function toLeadRecord(row: Record<string, unknown>): LeadRecord {
  return {
    ...(row as unknown as LeadRecord),
    id: Number(row.id),
    company_id: row.company_id === null || row.company_id === undefined ? null : Number(row.company_id),
  };
}

const isUniqueViolation = (err: unknown) => (err as { code?: string } | null)?.code === "23505";

function companySourceFor(leadSource: string): CompanySource {
  return leadSource === "linkedin_extension" || leadSource === "extension" ? "extension" : "manual";
}

export async function insertLead(workspaceId: number, input: LeadFields, source: string): Promise<LeadRecord> {
  // A person reviews both manual entries and extension captures before saving, so anything we'd silently drop is an error.
  const v = validateOrThrow(input, source === "manual" || source === "extension");
  const stage = input.stage?.trim() || "new";
  await assertLeadEmailAvailable(workspaceId, v.email);

  const company = await matchOrCreateCompany(
    { workspaceId },
    { name: v.company, domain: v.companyDomain },
    companySourceFor(source),
  );

  try {
    const inserted = await sql.query(
      `insert into leads (workspace_id, first_name, last_name, full_name, email, email_status, company, company_id,
                          job_title, linkedin_url, phone, source_url, stage, source)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       returning ${RETURNING}`,
      [workspaceId, v.firstName, v.lastName, v.fullName, v.email, v.emailStatus, v.company, company?.id ?? null,
        v.jobTitle, v.linkedinUrl, v.phone, v.sourceUrl, stage, source],
    );
    return toLeadRecord(inserted[0]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "A lead with this email already exists.");
    throw err;
  }
}

export async function updateLeadFields(workspaceId: number, id: number, input: LeadFields): Promise<LeadRecord> {
  const v = validateOrThrow(input, true);
  const stage = input.stage?.trim() || "new";
  await assertLeadEmailAvailable(workspaceId, v.email, id);

  const company = await matchOrCreateCompany({ workspaceId }, { name: v.company, domain: v.companyDomain }, "manual");

  try {
    // An unchanged email keeps its status (it may have been upgraded by an MX check); a changed one is re-classified.
    const updated = await sql.query(
      `update leads set
         first_name = $3, last_name = $4, full_name = $5,
         email_status = case when lower(coalesce(email, '')) = lower(coalesce($6::text, '')) then email_status else $7 end,
         email = $6, company = $8, company_id = $9, job_title = $10, linkedin_url = $11, phone = $12,
         stage = $13, updated_at = now()
       where id = $1 and workspace_id = $2
       returning ${RETURNING}`,
      [id, workspaceId, v.firstName, v.lastName, v.fullName, v.email, classifyEmail(v.email).status,
        v.company, company?.id ?? null, v.jobTitle, v.linkedinUrl, v.phone, stage],
    );
    if (updated.length === 0) throw new AppError("NOT_FOUND", "Lead not found");
    return toLeadRecord(updated[0]);
  } catch (err) {
    if (isUniqueViolation(err)) throw new AppError("CONFLICT", "A lead with this email already exists.");
    throw err;
  }
}
