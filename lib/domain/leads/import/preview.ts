import { validateLeadInput, type ImportField, type IssueCode, type LeadInput, type LeadIssue, type NormalizedLead } from "../validate";
import type { HeaderMapping } from "./headers";

/**
 * previewImport: the pure heart of the Upload → Preview → Map → Validate →
 * Dedupe steps. No I/O, so it runs in the browser for instant feedback AND in
 * unit tests; the server never trusts it (each chunk is re-validated there).
 */

export type RawRow = Record<string, string | undefined>;

export type ImportOptions = {
  /** What to do when a lead already exists: leave it, or fill only its blank fields. Never overwrites. */
  existing: "skip" | "update_blank";
  /** Look up MX records for email domains (slower). */
  checkMx: boolean;
};
export const DEFAULT_IMPORT_OPTIONS: ImportOptions = { existing: "skip", checkMx: false };

export type PreviewRow = {
  /** Row number as the user sees it in their spreadsheet (header = row 1). */
  row: number;
  input: LeadInput;
  lead: NormalizedLead | null;
  issues: LeadIssue[];
  status: "new" | "duplicate_in_file" | "invalid";
  duplicateOf?: number;
};

export type RowProblem = { row: number; code: IssueCode | "duplicate_in_file"; message: string };

export type PreviewSummary = {
  total: number;
  importable: number;
  invalid: number;
  duplicateInFile: number;
  missingEmail: number;
  roleAccounts: number;
  disposable: number;
  invalidLinkedin: number;
};

export type PreviewResult = {
  mapped: PreviewRow[];
  errors: RowProblem[];
  duplicates: { row: number; of: number; email: string }[];
  summary: PreviewSummary;
};

export function applyMapping(raw: RawRow, mapping: HeaderMapping): LeadInput {
  const out: Partial<Record<ImportField, string>> = {};
  for (const [header, field] of Object.entries(mapping)) {
    if (!field) continue;
    const value = raw[header]?.trim();
    if (value && !out[field]) out[field] = value; // first non-empty column wins when two map to one field
  }
  return out;
}

export function previewImport(rows: RawRow[], mapping: HeaderMapping): PreviewResult {
  const mapped: PreviewRow[] = [];
  const errors: RowProblem[] = [];
  const duplicates: PreviewResult["duplicates"] = [];
  const firstSeen = new Map<string, number>();
  const summary: PreviewSummary = {
    total: rows.length, importable: 0, invalid: 0, duplicateInFile: 0,
    missingEmail: 0, roleAccounts: 0, disposable: 0, invalidLinkedin: 0,
  };

  rows.forEach((raw, index) => {
    const row = index + 2;
    const input = applyMapping(raw, mapping);
    const { lead, issues } = validateLeadInput(input);
    const has = (code: IssueCode) => issues.some((i) => i.code === code);

    if (has("missing_email")) summary.missingEmail++;
    if (has("role_account")) summary.roleAccounts++;
    if (has("disposable_domain")) summary.disposable++;
    if (has("invalid_linkedin_url")) summary.invalidLinkedin++;

    if (!lead) {
      summary.invalid++;
      for (const i of issues.filter((x) => x.severity === "error")) errors.push({ row, code: i.code, message: i.message });
      mapped.push({ row, input, lead: null, issues, status: "invalid" });
      return;
    }

    if (lead.email) {
      const seenAt = firstSeen.get(lead.email);
      if (seenAt !== undefined) {
        summary.duplicateInFile++;
        duplicates.push({ row, of: seenAt, email: lead.email });
        errors.push({ row, code: "duplicate_in_file", message: `Duplicate of row ${seenAt} (same email)` });
        mapped.push({ row, input, lead, issues, status: "duplicate_in_file", duplicateOf: seenAt });
        return;
      }
      firstSeen.set(lead.email, row);
    }
    summary.importable++;
    mapped.push({ row, input, lead, issues, status: "new" });
  });

  return { mapped, errors, duplicates, summary };
}

export type ExistingClassification = {
  /** New = will be created. */
  new: number;
  /** Already in the workspace (matched by email). */
  existing: number;
  duplicateInFile: number;
  invalid: number;
  /** Importable rows whose email is on the Do Not Contact list: imported, but blocked from campaigns. */
  blocked: number;
};

/** Pure: fold the server's "which of these emails already exist / are suppressed" answer into the preview. */
export function classifyAgainstExisting(
  preview: PreviewResult,
  existingEmails: ReadonlySet<string>,
  blockedEmails: ReadonlySet<string>,
): ExistingClassification {
  const out: ExistingClassification = { new: 0, existing: 0, duplicateInFile: preview.summary.duplicateInFile, invalid: preview.summary.invalid, blocked: 0 };
  for (const r of preview.mapped) {
    if (r.status !== "new" || !r.lead) continue;
    const email = r.lead.email;
    if (email && existingEmails.has(email)) out.existing++;
    else out.new++;
    if (email && blockedEmails.has(email)) out.blocked++;
  }
  return out;
}

export const MAX_IMPORT_ROWS = 5000;
export const IMPORT_CHUNK_SIZE = 200;
