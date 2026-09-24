import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { getWorkspaceProfile } from "@/lib/db/workspace-profile";
import { corporateDomainFromEmail } from "@/lib/domain/leads/email";
import { normalizeDomain } from "@/lib/domain/companies/normalize";
import { EMPTY_ICP, parseStoredIcp, type Icp } from "@/lib/domain/workspace/icp";
import { toEngineIcp } from "./icp";
import type { EngineRunRequest } from "./schemas";

/**
 * The ONLY place workspace data is selected for the research engine. The engine is workspace-agnostic: it
 * receives the ICP and positioning as data, never an identity, and can neither read nor write product tables.
 */

const DEFAULT_BUDGETS = { max_seconds: 120, max_pages: 25, max_search_queries: 8, max_llm_calls: 12, max_cost_usd: 0.6 };

export type ResearchSubject = {
  companyName: string;
  domain: string | null;
  location: string | null;
  companyId: number | null;
  lead: { id: number; name: string; title: string | null; linkedinUrl: string | null } | null;
};

/** Loads the lead/company (workspace-scoped) and works out what can actually be researched. */
export async function loadLeadSubject(workspaceId: number, leadId: number): Promise<ResearchSubject> {
  const rows = await sql`
    select l.id, l.full_name, l.email, l.company, l.job_title, l.linkedin_url, l.company_id,
           c.name as company_name, c.domain as company_domain, c.location as company_location
    from leads l
    left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
    where l.id = ${leadId} and l.workspace_id = ${workspaceId}
  `;
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Lead not found.");
  const r = rows[0];
  const companyName = String(r.company_name ?? r.company ?? "").trim();
  // Best first-party domain we can defend: the canonical company's, else a corporate (non-free-mail) email domain.
  const domain = normalizeDomain(r.company_domain as string | null) ?? corporateDomainFromEmail(r.email as string | null);
  if (!companyName && !domain) {
    throw new AppError("VALIDATION_ERROR", "This lead has no company or company website to research. Add one first.");
  }
  return {
    companyName: companyName || domain!,
    domain,
    location: (r.company_location as string | null) ?? null,
    companyId: r.company_id === null ? null : Number(r.company_id),
    lead: { id: Number(r.id), name: String(r.full_name), title: (r.job_title as string | null) ?? null, linkedinUrl: (r.linkedin_url as string | null) ?? null },
  };
}

export async function loadCompanySubject(workspaceId: number, companyId: number): Promise<ResearchSubject> {
  const rows = await sql`select id, name, domain, location from companies where id = ${companyId} and workspace_id = ${workspaceId}`;
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Company not found.");
  const r = rows[0];
  return { companyName: String(r.name), domain: (r.domain as string | null) ?? null, location: (r.location as string | null) ?? null, companyId, lead: null };
}

export async function loadWorkspaceContext(workspaceId: number): Promise<{ icp: Icp; positioning: string }> {
  const p = await getWorkspaceProfile(workspaceId);
  return { icp: parseStoredIcp(p.icp) ?? EMPTY_ICP, positioning: p.positioning ?? "" };
}

export async function buildResearchRequest(
  workspaceId: number,
  subject: ResearchSubject,
  opts: { idempotencyKey: string; task?: EngineRunRequest["task"]; freshnessDays?: number },
): Promise<EngineRunRequest> {
  const { icp, positioning } = await loadWorkspaceContext(workspaceId);
  return {
    idempotency_key: opts.idempotencyKey,
    task: opts.task ?? (subject.lead ? "lead_research" : "company_research"),
    input: {
      company: { name: subject.companyName, domain: subject.domain, location: subject.location },
      lead: subject.lead ? { name: subject.lead.name, title: subject.lead.title, linkedin_url: subject.lead.linkedinUrl } : null,
      freshness_days: opts.freshnessDays ?? 14,
    },
    context: {
      icp: toEngineIcp(icp),
      positioning,
      // Words from what the seller sells help the engine pick relevant signals/queries.
      offer_keywords: extractOfferKeywords(positioning, icp),
      locale: "en",
    },
    budgets: DEFAULT_BUDGETS,
  };
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "your", "you", "our", "from", "into", "without", "help", "helps", "more", "who", "are", "can"]);

export function extractOfferKeywords(positioning: string, icp: Icp): string[] {
  const words = positioning.toLowerCase().match(/[a-z][a-z0-9+-]{3,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) if (!STOP.has(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
  const fromText = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w).slice(0, 6);
  return Array.from(new Set([...icp.scoring.keywords.map((k) => k.keyword.toLowerCase()), ...fromText])).slice(0, 10);
}
