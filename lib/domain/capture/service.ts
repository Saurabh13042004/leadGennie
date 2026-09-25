import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { proposeWithLlm, type LlmProposer } from "@/lib/ai/capture-extract";
import { recordLeadProvenance, type ProvenanceRow } from "@/lib/db/capture";
import { findCompanyCandidates } from "@/lib/db/companies";
import { insertLead } from "@/lib/db/leads-core";
import { findLeadByIdentity, type LeadRef, getLeadRef } from "@/lib/db/leads-lookup";
import { recordUsage } from "@/lib/domain/usage/record";
import { normalizeCompanyName, normalizeDomain } from "@/lib/domain/companies/normalize";
import { classifyEmail } from "@/lib/domain/leads/email";
import { validateLeadInput } from "@/lib/domain/leads/validate";
import { classifyPage, domainFromEmailIfCorporate, mergeProposals, type Proposal } from "./extractors";
import type { Candidate, FieldName, FieldSource, LeadDraft, PageFacts } from "./schemas";

/**
 * Capture pipeline: page facts → proposed lead (deterministic first, grounded LLM only for gaps) → a person
 * reviews and edits in the extension → captureLead() saves it through the same core as the manual form.
 * Nothing here is ever treated as VERIFIED evidence: a captured value is user-confirmed data with provenance
 * 'extension' / 'user', and research (Phase 2) is what verifies claims.
 */

export type CaptureCtx = { workspaceId: number; userId: number | null };
export type CaptureDeps = {
  propose: LlmProposer;
  /** Existing company domain for a name (only when exactly one workspace company has that name). */
  domainForCompany: (workspaceId: number, companyName: string) => Promise<string | null>;
};

export const defaultCaptureDeps: CaptureDeps = {
  propose: proposeWithLlm,
  async domainForCompany(workspaceId, name) {
    const key = normalizeCompanyName(name);
    if (!key) return null;
    const matches = (await findCompanyCandidates(workspaceId, [], [key])).filter((c) => c.domain);
    return matches.length === 1 ? matches[0].domain : null;
  },
};

const MAX_TEXT_FOR_MODEL = 12_000;

/** Query strings and fragments often carry tracking ids or tokens: never store or send them onward. */
export function cleanSourceUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, ""); // one canonical spelling of a page
    return u.toString();
  } catch {
    return url;
  }
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

/** A model-proposed value counts only if it literally appears on the page (case/whitespace-insensitive). */
function grounded(value: string, haystack: string): boolean {
  const v = norm(value).trim();
  return v.length >= 2 && haystack.includes(v);
}

export async function extractCandidate(
  ctx: CaptureCtx,
  input: PageFacts,
  deps: CaptureDeps = defaultCaptureDeps,
): Promise<{ candidate: Candidate; existing: LeadRef | null }> {
  const facts: PageFacts = { ...input, url: cleanSourceUrl(input.url), text: input.text.slice(0, MAX_TEXT_FOR_MODEL) };
  const pageKind = classifyPage(facts.url);
  const { fields, sources } = mergeProposals(facts, pageKind);
  const warnings: string[] = [];
  let usedLlm = false;

  // ---- LLM only for gaps, and only when there is something to read --------------------------------------
  const needsModel = (!fields.fullName || !fields.company) && (facts.text.trim().length > 40 || !!facts.selection);
  if (needsModel && pageKind !== "linkedin_other") {
    try {
      const usage: Parameters<typeof recordUsage>[1] = [];
      const proposed = await deps.propose(facts, {
        onUsage: (u) => usage.push({ kind: "llm", provider: "openai", model: u.model, tokensIn: u.tokensIn, tokensOut: u.tokensOut }),
      });
      await recordUsage({ workspaceId: ctx.workspaceId, userId: ctx.userId }, usage, { type: "extension_capture" }).catch(() => {});
      usedLlm = true;
      const haystack = norm([facts.title, facts.headings.join(" "), facts.selection ?? "", facts.text].join(" "));
      let dropped = false;
      for (const [k, v] of Object.entries(proposed) as [FieldName, string][]) {
        if (fields[k]) continue;
        if (grounded(v, haystack)) {
          fields[k] = v;
          sources[k] = "llm";
        } else dropped = true;
      }
      if (dropped) warnings.push("Some details couldn't be confirmed on this page and were left blank.");
    } catch {
      // Model unavailable (quota, key, network): the card simply opens with what the page itself gave us.
      warnings.push("Automatic reading is unavailable right now — fill in the details below.");
    }
  }

  // ---- Company domain: strongest evidence wins -------------------------------------------------------------
  // The page's own host is the WEAKEST signal: a company's team page says "this is their site", but a blog post or
  // a news article about someone says nothing about where they work. So a corporate email domain, then a company
  // already in this workspace, both beat the host; the host is only used when nothing else is known.
  const weakHost = sources.companyDomain === "site";
  const overrideDomain = (domain: string | null | undefined, source: FieldSource) => {
    if (domain && (!fields.companyDomain || weakHost) && sources.companyDomain !== source) {
      fields.companyDomain = domain;
      sources.companyDomain = source;
    }
  };
  overrideDomain(domainFromEmailIfCorporate(fields.email), "email_domain");
  if ((!fields.companyDomain || sources.companyDomain === "site") && fields.company) {
    overrideDomain(await deps.domainForCompany(ctx.workspaceId, fields.company), "workspace");
  }
  if (fields.companyDomain) fields.companyDomain = normalizeDomain(fields.companyDomain) ?? undefined;

  // ---- Cautions from the same validator the manual form uses ---------------------------------------------
  const { issues } = validateLeadInput({
    full_name: fields.fullName, job_title: fields.jobTitle, company: fields.company, company_domain: fields.companyDomain,
    email: fields.email, linkedin_url: fields.linkedinUrl,
  });
  for (const i of issues) if (i.code !== "missing_email" && i.code !== "missing_name") warnings.push(i.message);

  const structured = fields.fullName && sources.fullName !== "llm" && (fields.jobTitle || fields.company);
  const confidence: Candidate["confidence"] = structured ? "high" : fields.fullName ? "medium" : "low";

  const candidate: Candidate = { fields, sources, confidence, warnings, usedLlm, pageKind, sourceUrl: facts.url };
  const existing = await findLeadByIdentity(ctx.workspaceId, {
    email: fields.email, linkedinUrl: fields.linkedinUrl, fullName: fields.fullName, company: fields.company,
  });
  return { candidate, existing };
}

export type CaptureResult = { created: boolean; lead: LeadRef };

/** Save a reviewed card. If the person is already a lead, nothing is created and the existing lead is returned. */
export async function captureLead(ctx: CaptureCtx, draft: LeadDraft): Promise<CaptureResult> {
  const existing = await findLeadByIdentity(ctx.workspaceId, {
    email: draft.email, linkedinUrl: draft.linkedin_url, fullName: draft.full_name, company: draft.company,
  });
  if (existing) return { created: false, lead: existing };

  const record = await insertLead(
    ctx.workspaceId,
    {
      full_name: draft.full_name, job_title: draft.job_title, company: draft.company, company_domain: draft.company_domain,
      email: draft.email, phone: draft.phone, linkedin_url: draft.linkedin_url,
      source_url: draft.source_url ? cleanSourceUrl(draft.source_url) : null,
    },
    "extension",
  );
  const lead = await getLeadRef(ctx.workspaceId, record.id);
  if (!lead) throw new AppError("INTERNAL_ERROR", "The lead was saved but could not be read back.");

  const edited = new Set(draft.edited_fields);
  const provenance: ProvenanceRow[] = [
    ["full_name", draft.full_name], ["job_title", draft.job_title], ["company", draft.company], ["email", draft.email],
    ["linkedin_url", record.linkedin_url],
  ].flatMap(([field, value]) =>
    value ? [{ field: field as string, value: value as string, source: edited.has(field as never) ? ("user" as const) : ("extension" as const), confidence: null }] : [],
  );
  await recordLeadProvenance(ctx.workspaceId, record.id, provenance).catch(() => {});
  await logActivity({
    workspaceId: ctx.workspaceId, actorUserId: ctx.userId, type: "lead.captured", entityType: "lead", entityId: record.id,
    summary: `Captured ${record.full_name} from the browser extension`,
    metadata: { source_url: draft.source_url ? cleanSourceUrl(draft.source_url) : null, email_status: classifyEmail(draft.email).status },
  });
  return { created: true, lead };
}

export type { Proposal };
