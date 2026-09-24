import { classifyEmail, corporateDomainFromEmail, type EmailFlag, type EmailStatus, type MxResult } from "./email";
import { joinName, splitFullName } from "./names";
import { normalizeDomain } from "../companies/normalize";
import { normalizeLinkedinUrl } from "./urls";

/**
 * The one place a lead's raw fields become a validated, normalized lead. Used by
 * the manual form, the extension route and every import chunk, so the three
 * entry points can never disagree about what a valid lead is (SRP + one source
 * of truth). Pure: no I/O, no clock.
 */

export const IMPORT_FIELDS = [
  "first_name",
  "last_name",
  "full_name",
  "email",
  "company",
  "company_domain",
  "job_title",
  "linkedin_url",
  "phone",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** Raw (untrusted) lead fields, as strings. */
export type LeadInput = Partial<Record<ImportField | "source_url", string | null | undefined>>;

export const LEAD_LIMITS = { name: 200, email: 254, company: 200, jobTitle: 200, phone: 50, url: 500 } as const;

export type IssueCode =
  | "missing_name"
  | "invalid_email"
  | "field_too_long"
  | "missing_email"
  | "role_account"
  | "disposable_domain"
  | "invalid_linkedin_url"
  | "invalid_company_domain"
  | "no_mx";

export type LeadIssue = {
  /** error → the row cannot be imported; warning → imported, but the user should know. */
  severity: "error" | "warning";
  code: IssueCode;
  field: ImportField | "row";
  message: string;
};

export type NormalizedLead = {
  firstName: string | null;
  lastName: string | null;
  /** Authoritative display name. */
  fullName: string;
  email: string | null;
  emailStatus: EmailStatus;
  emailFlags: EmailFlag[];
  company: string | null;
  /** Explicit company_domain when valid, else the corporate email domain, else null. */
  companyDomain: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  phone: string | null;
  sourceUrl: string | null;
};

export type ValidationResult = { lead: NormalizedLead | null; issues: LeadIssue[] };

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Strips control characters (Postgres rejects NUL outright), collapses whitespace, trims; empty → null. */
export function cleanText(value: string | null | undefined): string | null {
  const s = (value ?? "").replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  return s || null;
}

export function validateLeadInput(input: LeadInput, opts: { mx?: MxResult } = {}): ValidationResult {
  const issues: LeadIssue[] = [];
  const error = (code: IssueCode, field: LeadIssue["field"], message: string) =>
    issues.push({ severity: "error", code, field, message });
  const warn = (code: IssueCode, field: LeadIssue["field"], message: string) =>
    issues.push({ severity: "warning", code, field, message });

  const first = cleanText(input.first_name);
  const last = cleanText(input.last_name);
  const full = cleanText(input.full_name) ?? (joinName(first, last) || null);
  if (!full) error("missing_name", "full_name", "Missing name (need a full name, or first and last name)");

  const tooLong = (field: ImportField, value: string | null, max: number) => {
    if (value && value.length > max) {
      error("field_too_long", field, `${field} is longer than ${max} characters`);
      return true;
    }
    return false;
  };
  const company = cleanText(input.company);
  const jobTitle = cleanText(input.job_title);
  const phone = cleanText(input.phone);
  tooLong("full_name", full, LEAD_LIMITS.name);
  tooLong("first_name", first, LEAD_LIMITS.name);
  tooLong("last_name", last, LEAD_LIMITS.name);
  tooLong("company", company, LEAD_LIMITS.company);
  tooLong("job_title", jobTitle, LEAD_LIMITS.jobTitle);
  tooLong("phone", phone, LEAD_LIMITS.phone);

  const rawEmail = cleanText(input.email);
  const emailClass = classifyEmail(rawEmail, { mx: opts.mx });
  if (rawEmail && emailClass.flags.includes("invalid_syntax")) {
    error("invalid_email", "email", `Invalid email address "${rawEmail.slice(0, 80)}"`);
  } else if (!rawEmail) {
    warn("missing_email", "email", "No email — can't be emailed until one is added");
  } else {
    if (emailClass.flags.includes("disposable")) warn("disposable_domain", "email", "Disposable email domain — flagged risky");
    if (emailClass.flags.includes("role_account")) warn("role_account", "email", "Role account (e.g. info@, noreply@) — flagged risky");
    if (emailClass.flags.includes("no_mx")) warn("no_mx", "email", "Domain has no mail server — flagged invalid");
  }

  let linkedinUrl: string | null = null;
  const rawLinkedin = cleanText(input.linkedin_url);
  if (rawLinkedin) {
    linkedinUrl = normalizeLinkedinUrl(rawLinkedin);
    if (!linkedinUrl) warn("invalid_linkedin_url", "linkedin_url", "Not a LinkedIn profile URL — left blank");
  }

  let explicitDomain: string | null = null;
  const rawDomain = cleanText(input.company_domain);
  if (rawDomain) {
    explicitDomain = normalizeDomain(rawDomain);
    if (!explicitDomain) warn("invalid_company_domain", "company_domain", "Not a valid company domain/website — ignored");
  }

  if (issues.some((i) => i.severity === "error") || !full) return { lead: null, issues };

  const split = splitFullName(full);
  const email = rawEmail && !emailClass.flags.includes("invalid_syntax") ? emailClass.email : null;
  return {
    issues,
    lead: {
      firstName: first ?? split.firstName,
      lastName: last ?? split.lastName,
      fullName: full,
      email,
      emailStatus: emailClass.status,
      emailFlags: emailClass.flags,
      company,
      companyDomain: explicitDomain ?? corporateDomainFromEmail(email),
      jobTitle,
      linkedinUrl,
      phone,
      sourceUrl: cleanText(input.source_url),
    },
  };
}
