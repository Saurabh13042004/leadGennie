import { z } from "zod";
import { AppError, ok } from "@/lib/api";
import { extractCandidate, captureLead } from "@/lib/domain/capture/service";
import { leadDraftSchema } from "@/lib/domain/capture/schemas";
import { listRecentLeads } from "@/lib/db/leads-lookup";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";


/** GET /api/extension/leads?limit=&q= — the workspace's most recent leads, so the popup mirrors the dashboard. */
export const GET = extensionRoute({ scope: "leads:read" }, async (request, identity) => {
  const u = new URL(request.url);
  const limit = Math.min(Math.max(Number.parseInt(u.searchParams.get("limit") ?? "20", 10) || 20, 1), 50);
  const { leads, total } = await listRecentLeads(identity.workspaceId, { limit, q: u.searchParams.get("q") ?? undefined });
  return ok({ leads, total });
});

/** Older extension builds sent the raw page text and let the server work out the person. Still accepted. */
const legacyBody = z.object({
  pageText: z.string().trim().min(1).max(200_000),
  linkedin_url: z.string().trim().max(500).optional(),
});
const newBody = z.object({ lead: leadDraftSchema });

/**
 * POST /api/extension/leads — save a lead the person reviewed in the capture card.
 * If they're already a lead nothing is created: `created: false` plus the existing lead ("Already in LeadGennie").
 */
export const POST = extensionRoute({ scope: "leads:create" }, async (request, identity) => {
  const raw: unknown = await request.json().catch(() => {
    throw new AppError("BAD_REQUEST", "Request body must be valid JSON.");
  });
  const ctx = { workspaceId: identity.workspaceId, userId: identity.userId };

  const modern = newBody.safeParse(raw);
  if (modern.success) {
    const r = await captureLead(ctx, modern.data.lead);
    return ok({ created: r.created, lead: r.lead }, { status: r.created ? 201 : 200 });
  }

  const legacy = legacyBody.safeParse(raw);
  if (!legacy.success) throw modern.error;
  const { candidate } = await extractCandidate(ctx, {
    url: legacy.data.linkedin_url || "https://www.linkedin.com/in/unknown", title: "", text: legacy.data.pageText,
    headings: [], jsonld: [], emails: [],
  });
  if (!candidate.fields.fullName) throw new AppError("VALIDATION_ERROR", "Couldn't read a name from that page — use the capture card to enter it.");
  const r = await captureLead(ctx, {
    full_name: candidate.fields.fullName, job_title: candidate.fields.jobTitle, company: candidate.fields.company,
    company_domain: candidate.fields.companyDomain, email: candidate.fields.email, linkedin_url: candidate.fields.linkedinUrl,
    source_url: candidate.sourceUrl, edited_fields: [],
  });
  return ok({ created: r.created, lead: r.lead, full_name: r.lead.fullName }, { status: r.created ? 201 : 200 });
});
