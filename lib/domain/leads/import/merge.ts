import type { NormalizedLead } from "../validate";

/**
 * "Update blank fields only" (WP1.2): decide what an import may write onto a
 * lead that already exists. Non-empty existing values are NEVER overwritten —
 * not even with a "better" value — and full_name is never touched.
 */

export type ExistingLeadState = {
  id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  company_id: number | null;
  linkedin_url: string | null;
  source_url: string | null;
};

export type FillPatch = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  job_title: string | null;
  company: string | null;
  company_id: number | null;
  linkedin_url: string | null;
  source_url: string | null;
  email: string | null;
  email_status: string | null;
  /** Names of the fields this patch will actually fill (for the report). */
  filled: string[];
};

const blank = (v: string | number | null | undefined) => v === null || v === undefined || v === "";

/** The blanks on `existing` that `incoming` can fill, or null when there is nothing to fill. */
export function computeFill(existing: ExistingLeadState, incoming: NormalizedLead, companyId: number | null): FillPatch | null {
  const filled: string[] = [];
  const pick = <T extends string | number>(field: string, current: T | null, next: T | null): T | null => {
    if (blank(current) && !blank(next)) {
      filled.push(field);
      return next;
    }
    return null;
  };

  const patch: FillPatch = {
    id: existing.id,
    first_name: pick("first_name", existing.first_name, incoming.firstName),
    last_name: pick("last_name", existing.last_name, incoming.lastName),
    phone: pick("phone", existing.phone, incoming.phone),
    job_title: pick("job_title", existing.job_title, incoming.jobTitle),
    company: pick("company", existing.company, incoming.company),
    company_id: pick("company", existing.company_id, companyId),
    linkedin_url: pick("linkedin_url", existing.linkedin_url, incoming.linkedinUrl),
    source_url: pick("source_url", existing.source_url, incoming.sourceUrl),
    email: pick("email", existing.email, incoming.email),
    email_status: null,
    filled: [],
  };
  if (patch.email) patch.email_status = incoming.emailStatus;
  patch.filled = Array.from(new Set(filled));
  return patch.filled.length > 0 ? patch : null;
}
