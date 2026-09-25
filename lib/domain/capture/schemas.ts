import { z } from "zod";

/**
 * Wire shapes for browser capture. The extension is a dumb collector: it sends what a page LOOKS like
 * (`PageFacts`) and the server decides what it means. That keeps the extraction logic in one testable place
 * instead of being scattered through content scripts that can't be unit-tested.
 */

const str = (max: number) => z.string().max(max);

export const pageFactsSchema = z.object({
  /** The page's URL (the extension sends location.href; query/hash are stripped server-side before storing). */
  url: str(2000).url(),
  title: str(500).default(""),
  /** Visible text of <main>/<body>, capped by the extension; the server caps it again before any LLM call. */
  text: str(60_000).default(""),
  /** Text the user selected, if any — an explicit signal that beats everything the page says. */
  selection: str(5_000).optional(),
  headings: z.array(str(200)).max(12).default([]),
  siteName: str(200).optional(),
  canonicalUrl: str(2000).optional(),
  /** Parsed <script type="application/ld+json"> payloads (already JSON.parse'd by the extension). */
  jsonld: z.array(z.unknown()).max(20).default([]),
  /** Addresses found in mailto: links. */
  emails: z.array(str(320)).max(30).default([]),
});
export type PageFacts = z.infer<typeof pageFactsSchema>;

export const FIELD_NAMES = ["fullName", "jobTitle", "company", "companyDomain", "email", "linkedinUrl"] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

/** Where a proposed value came from — shown to the user and recorded as provenance. */
export type FieldSource = "jsonld" | "linkedin_title" | "selection" | "site" | "mailto" | "llm" | "workspace" | "email_domain";

export type PageKind = "linkedin_profile" | "linkedin_other" | "web";

export type Candidate = {
  fields: Partial<Record<FieldName, string>>;
  sources: Partial<Record<FieldName, FieldSource>>;
  confidence: "high" | "medium" | "low";
  /** Human-readable cautions (role-account email, value could not be verified on the page, …). */
  warnings: string[];
  usedLlm: boolean;
  pageKind: PageKind;
  sourceUrl: string;
};

/** What the capture card sends back to create the lead: the user has reviewed and may have edited every field. */
export const leadDraftSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  job_title: z.string().trim().max(200).nullish(),
  company: z.string().trim().max(200).nullish(),
  company_domain: z.string().trim().max(253).nullish(),
  email: z.string().trim().max(254).nullish(),
  phone: z.string().trim().max(50).nullish(),
  linkedin_url: z.string().trim().max(500).nullish(),
  source_url: z.string().trim().max(2000).nullish(),
  /** Which fields the user typed or changed vs accepted from the page (provenance: 'user' vs 'extension'). */
  edited_fields: z.array(z.enum(["full_name", "job_title", "company", "company_domain", "email", "phone", "linkedin_url"])).max(7).default([]),
});
export type LeadDraft = z.infer<typeof leadDraftSchema>;
