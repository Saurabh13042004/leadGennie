import { IMPORT_FIELDS, type ImportField } from "../validate";

/**
 * Header auto-mapping (WP1.2). Maps a CSV's column headers onto our import
 * fields using known export vocabularies (Apollo, HubSpot, LinkedIn Sales
 * Navigator, generic spreadsheets). The user can override every guess; this
 * only supplies the starting point.
 *
 * Guarantees: each field is claimed by at most one column (exact-name matches
 * beat fuzzy ones, then left-to-right), and a company-level LinkedIn column is
 * never mistaken for the person's.
 */

export type HeaderMapping = Record<string, ImportField | "">;

export const FIELD_LABELS: Record<ImportField, string> = {
  first_name: "First name",
  last_name: "Last name",
  full_name: "Full name",
  email: "Email",
  company: "Company",
  company_domain: "Company domain / website",
  job_title: "Job title",
  linkedin_url: "LinkedIn URL",
  phone: "Phone",
};

const canon = (header: string) => header.toLowerCase().replace(/[^a-z0-9]/g, "");

const EXACT: Record<ImportField, string[]> = {
  first_name: ["firstname", "first", "givenname", "fname", "forename", "contactfirstname", "personfirstname"],
  last_name: ["lastname", "last", "surname", "familyname", "lname", "contactlastname", "personlastname"],
  full_name: ["fullname", "name", "contactname", "personname", "leadname", "displayname", "contact", "prospectname"],
  email: ["email", "emailaddress", "workemail", "businessemail", "emailid", "mail", "primaryemail", "contactemail", "email1", "personemail"],
  company: [
    "company", "companyname", "organization", "organisation", "org", "account", "accountname", "employer",
    "currentcompany", "business", "businessname", "organizationname", "organisationname",
  ],
  company_domain: [
    "companydomain", "domain", "website", "websiteurl", "companywebsite", "companyurl", "url", "site", "web",
    "companydomainname", "organizationwebsite", "organizationdomain", "companywebsiteurl",
  ],
  job_title: ["jobtitle", "title", "position", "role", "jobposition", "designation", "currenttitle", "occupation", "jobrole", "persontitle"],
  linkedin_url: [
    "linkedinurl", "linkedin", "linkedinprofile", "linkedinprofileurl", "personlinkedinurl", "profileurl", "linkedinlink",
    "linkedinurlperson", "linkedinpersonurl", "contactlinkedin",
  ],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "mobilenumber", "cell", "cellphone", "telephone", "tel", "workphone", "directphone"],
};

/** Columns that look like a match but describe something else. Never mapped. */
const NEVER = new Set([
  "companylinkedinurl", "companylinkedin", "organizationlinkedinurl", "companylinkedinprofile", "accountlinkedin",
  "companyphone", "organizationphone", "companyemail",
]);

// Fuzzy fallbacks, evaluated in order on headers exact matching left unmapped.
const FUZZY: { field: ImportField; test: (h: string) => boolean }[] = [
  { field: "linkedin_url", test: (h) => h.includes("linkedin") && !h.includes("company") && !h.includes("organi") },
  { field: "email", test: (h) => h.includes("email") && !h.includes("status") && !h.includes("verified") },
  { field: "first_name", test: (h) => h.includes("firstname") || h.startsWith("first") },
  { field: "last_name", test: (h) => h.includes("lastname") || h.startsWith("last") || h.includes("surname") },
  { field: "phone", test: (h) => h.includes("phone") || h.includes("mobile") },
  { field: "job_title", test: (h) => h.includes("title") || h.includes("position") || h.includes("jobrole") },
  { field: "company_domain", test: (h) => h.includes("website") || h.includes("domain") },
  { field: "company", test: (h) => h.includes("company") || h.includes("organization") || h.includes("organisation") },
  { field: "full_name", test: (h) => h.endsWith("name") && !h.includes("company") && !h.includes("user") && !h.includes("file") },
];

const exactLookup = new Map<string, ImportField>(IMPORT_FIELDS.flatMap((f) => EXACT[f].map((h) => [h, f] as const)));

export function autoMapHeaders(headers: string[]): HeaderMapping {
  const mapping: HeaderMapping = {};
  const claimed = new Set<ImportField>();
  const canonical = headers.map(canon);

  headers.forEach((header, i) => {
    mapping[header] = "";
    const c = canonical[i];
    if (!c || NEVER.has(c)) return;
    const field = exactLookup.get(c);
    if (field && !claimed.has(field)) {
      mapping[header] = field;
      claimed.add(field);
    }
  });

  headers.forEach((header, i) => {
    if (mapping[header] || NEVER.has(canonical[i]) || !canonical[i]) return;
    for (const { field, test } of FUZZY) {
      if (!claimed.has(field) && test(canonical[i])) {
        mapping[header] = field;
        claimed.add(field);
        return;
      }
    }
  });

  return mapping;
}

/** A file is importable once a name can be built (full name, or first/last) — email is optional but flagged. */
export function hasRequiredMapping(mapping: HeaderMapping): boolean {
  const fields = new Set(Object.values(mapping).filter(Boolean));
  return fields.has("full_name") || fields.has("first_name") || fields.has("last_name");
}
