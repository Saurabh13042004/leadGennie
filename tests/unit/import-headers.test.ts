import { describe, expect, it } from "vitest";
import { autoMapHeaders, hasRequiredMapping } from "@/lib/domain/leads/import/headers";

const map = (headers: string[]) => autoMapHeaders(headers);

describe("autoMapHeaders — common variants", () => {
  const cases: [string, string][] = [
    ["First Name", "first_name"], ["first_name", "first_name"], ["Given Name", "first_name"], ["FirstName", "first_name"],
    ["Last Name", "last_name"], ["Surname", "last_name"], ["family-name", "last_name"],
    ["Full Name", "full_name"], ["Name", "full_name"], ["Contact Name", "full_name"],
    ["Email", "email"], ["E-mail", "email"], ["Email Address", "email"], ["Work Email", "email"], ["EMAIL_ID", "email"],
    ["Company", "company"], ["Company Name", "company"], ["Organization", "company"], ["Organisation", "company"], ["Account Name", "company"],
    ["Website", "company_domain"], ["Company Domain", "company_domain"], ["domain", "company_domain"], ["Company Website", "company_domain"],
    ["Title", "job_title"], ["Job Title", "job_title"], ["Position", "job_title"], ["Role", "job_title"],
    ["LinkedIn URL", "linkedin_url"], ["LinkedIn Profile", "linkedin_url"], ["Person Linkedin Url", "linkedin_url"], ["linkedin", "linkedin_url"],
    ["Phone", "phone"], ["Phone Number", "phone"], ["Mobile Phone", "phone"],
  ];
  it.each(cases)("%s → %s", (header, field) => {
    expect(map([header])[header]).toBe(field);
  });
});

describe("autoMapHeaders — real export shapes", () => {
  it("Apollo export", () => {
    const m = map(["First Name", "Last Name", "Title", "Company", "Email", "Website", "Person Linkedin Url", "Company Linkedin Url", "Mobile Phone", "Industry"]);
    expect(m).toMatchObject({
      "First Name": "first_name", "Last Name": "last_name", Title: "job_title", Company: "company", Email: "email",
      Website: "company_domain", "Person Linkedin Url": "linkedin_url", "Mobile Phone": "phone", Industry: "",
    });
    expect(m["Company Linkedin Url"]).toBe(""); // the company's page is never the person's profile
  });

  it("HubSpot export", () => {
    const m = map(["First Name", "Last Name", "Email", "Phone Number", "Company name", "Job Title", "Lifecycle Stage"]);
    expect(m).toMatchObject({ "Company name": "company", "Phone Number": "phone", "Job Title": "job_title", "Lifecycle Stage": "" });
  });

  it("the repo's own template", () => {
    const m = map(["full_name", "email", "company", "job_title", "linkedin_url"]);
    expect(Object.values(m)).toEqual(["full_name", "email", "company", "job_title", "linkedin_url"]);
  });
});

describe("autoMapHeaders — invariants", () => {
  it("claims each field at most once; the exact name beats a fuzzy one regardless of column order", () => {
    const m = map(["Work Email Verified Status", "Email", "Personal Email Backup"]);
    expect(m["Email"]).toBe("email");
    expect(Object.values(m).filter((f) => f === "email")).toHaveLength(1);
  });

  it("leaves unrecognised columns unmapped", () => {
    const m = map(["Favourite Colour", "Notes", ""]);
    expect(Object.values(m).every((f) => f === "")).toBe(true);
  });

  it("hasRequiredMapping needs a way to build a name", () => {
    expect(hasRequiredMapping(map(["Email"]))).toBe(false);
    expect(hasRequiredMapping(map(["Full Name"]))).toBe(true);
    expect(hasRequiredMapping(map(["First Name"]))).toBe(true);
  });
});
