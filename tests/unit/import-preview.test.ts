import { describe, expect, it } from "vitest";
import { applyMapping, classifyAgainstExisting, previewImport } from "@/lib/domain/leads/import/preview";
import { autoMapHeaders } from "@/lib/domain/leads/import/headers";
import { computeFill } from "@/lib/domain/leads/import/merge";
import { validateLeadInput } from "@/lib/domain/leads/validate";

const headers = ["First Name", "Last Name", "E-mail", "Organization", "Website", "Title", "LinkedIn URL"];
const mapping = autoMapHeaders(headers);
const csv = (...rows: string[][]) => rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));

describe("previewImport", () => {
  const rows = csv(
    ["Jane", "Doe", "jane@acme.com", "Acme Inc", "acme.com", "CEO", "https://linkedin.com/in/janedoe"],
    ["Bad", "Email", "nope", "Acme", "", "", ""],
    ["", "", "noname@acme.com", "", "", "", ""],
    ["Jane", "Again", "JANE@acme.com", "", "", "", ""],
    ["Info", "Box", "info@acme.com", "", "", "", ""],
    ["Temp", "Mail", "t@mailinator.com", "", "", "", ""],
    ["No", "Email", "", "", "", "", "linkedin.com/company/acme"],
  );
  const p = previewImport(rows, mapping);

  it("maps every row with spreadsheet row numbers (header is row 1)", () => {
    expect(p.mapped.map((r) => r.row)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(p.mapped[0].lead).toMatchObject({ fullName: "Jane Doe", email: "jane@acme.com", company: "Acme Inc", companyDomain: "acme.com", linkedinUrl: "https://www.linkedin.com/in/janedoe" });
  });

  it("reports invalid rows with reasons", () => {
    expect(p.errors.filter((e) => e.code !== "duplicate_in_file")).toEqual([
      expect.objectContaining({ row: 3, code: "invalid_email" }),
      expect.objectContaining({ row: 4, code: "missing_name" }),
    ]);
    expect(p.mapped[1].status).toBe("invalid");
  });

  it("detects in-file duplicates case-insensitively and points at the first occurrence", () => {
    expect(p.duplicates).toEqual([{ row: 5, of: 2, email: "jane@acme.com" }]);
    expect(p.mapped[3]).toMatchObject({ status: "duplicate_in_file", duplicateOf: 2 });
  });

  it("flags risky, disposable, missing-email and bad LinkedIn as warnings on importable rows", () => {
    expect(p.summary).toEqual({
      total: 7, importable: 4, invalid: 2, duplicateInFile: 1, missingEmail: 1, roleAccounts: 1, disposable: 1, invalidLinkedin: 1,
    });
    expect(p.mapped[4].issues.map((i) => i.code)).toContain("role_account");
    expect(p.mapped[5].issues.map((i) => i.code)).toContain("disposable_domain");
    expect(p.mapped[6].lead?.linkedinUrl).toBeNull();
  });

  it("classifies against existing leads and DNC", () => {
    const c = classifyAgainstExisting(p, new Set(["jane@acme.com", "info@acme.com"]), new Set(["t@mailinator.com"]));
    expect(c).toEqual({ new: 2, existing: 2, duplicateInFile: 1, invalid: 2, blocked: 1 });
  });

  it("first non-empty column wins when two columns map to one field", () => {
    const m = { A: "email", B: "email" } as const;
    expect(applyMapping({ A: "", B: "b@x.com" }, m)).toEqual({ email: "b@x.com" });
    expect(applyMapping({ A: "a@x.com", B: "b@x.com" }, m)).toEqual({ email: "a@x.com" });
  });
});

describe("validateLeadInput", () => {
  it("builds the name from first/last, and first/last from the full name", () => {
    expect(validateLeadInput({ first_name: "Ada", last_name: "Lovelace" }).lead).toMatchObject({ fullName: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace" });
    expect(validateLeadInput({ full_name: "Grace Hopper" }).lead).toMatchObject({ firstName: "Grace", lastName: "Hopper" });
  });
  it("strips control characters Postgres would reject", () => {
    expect(validateLeadInput({ full_name: "Bad\u0000Name" }).lead?.fullName).toBe("BadName");
  });
  it("company domain: explicit beats the email's; free-mail yields none", () => {
    expect(validateLeadInput({ full_name: "A", email: "a@acme.com", company_domain: "https://beta.io" }).lead?.companyDomain).toBe("beta.io");
    expect(validateLeadInput({ full_name: "A", email: "a@acme.com" }).lead?.companyDomain).toBe("acme.com");
    expect(validateLeadInput({ full_name: "A", email: "a@gmail.com" }).lead?.companyDomain).toBeNull();
  });
  it("enforces field length limits", () => {
    const r = validateLeadInput({ full_name: "x".repeat(201) });
    expect(r.lead).toBeNull();
    expect(r.issues[0].code).toBe("field_too_long");
  });
});

describe("computeFill — never overwrite non-empty values", () => {
  const existing = { id: 1, email: "a@x.com", first_name: "Ann", last_name: null, phone: "", job_title: "CEO", company: null, company_id: null, linkedin_url: null, source_url: null };
  const incoming = validateLeadInput({ full_name: "Different Name", first_name: "Other", last_name: "Person", email: "zzz@y.com", phone: "555", job_title: "Intern", company: "Acme", linkedin_url: "linkedin.com/in/x" }).lead!;

  it("fills only blanks (null or empty string)", () => {
    const patch = computeFill(existing, incoming, 42)!;
    expect(patch).toMatchObject({ last_name: "Person", phone: "555", company: "Acme", company_id: 42, linkedin_url: "https://www.linkedin.com/in/x" });
    expect(patch.first_name).toBeNull(); // existing "Ann" kept
    expect(patch.job_title).toBeNull(); // existing "CEO" kept
    expect(patch.email).toBeNull(); // existing email kept
    expect(patch.filled).not.toContain("email");
  });

  it("returns null when nothing can be filled", () => {
    const full = { ...existing, last_name: "L", phone: "1", company: "C", company_id: 1, linkedin_url: "u", source_url: "s" };
    expect(computeFill(full, incoming, 42)).toBeNull();
  });

  it("carries the email status only when it fills a blank email", () => {
    const blankEmail = { ...existing, email: null };
    expect(computeFill(blankEmail, incoming, null)).toMatchObject({ email: "zzz@y.com", email_status: "unverified" });
  });
});
