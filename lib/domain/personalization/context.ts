import { sql } from "@/lib/db/client";
import { dateOnly } from "@/lib/db/dates";
import { AppError } from "@/lib/api/errors";
import { isTone, type ContextEvidence, type PersonalizationContext, type Tone } from "./types";

/**
 * The ONLY place that decides what evidence reaches the model (spec WP3.1): verified, current, recent,
 * deduplicated, capped. Everything the generator may assert about a recipient comes out of here — and the
 * validators later hold the model to exactly this set.
 */

export const MAX_EVIDENCE = 12;
export const MAX_SNIPPET_CHARS = 400;
const DAY_MS = 86_400_000;

/** Signal types that are "news" for the toggle: withheld from the model unless the user turns it on. */
const NEWS_TYPES = new Set(["NEWS", "FUNDING"]);
/** How old a signal's evidence may be. Hiring goes stale fast; announcements linger longer. */
const MAX_AGE_DAYS: Record<string, number> = { HIRING: 60, JOB_POSTING: 60 };
const DEFAULT_MAX_AGE_DAYS = 180;

export type RawEvidenceRow = {
  id: number;
  claim: string;
  snippet: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceType: string;
  capturedAt: string;
  signalType: string | null;
  /** ISO date the signal happened (null = unknown). */
  detectedAt: string | null;
};

export type RawContext = {
  lead: { id: number; fullName: string; title: string | null };
  company: { name: string | null; domain: string | null; industry: string | null; description: string | null };
  sender: { name: string | null; company: string | null; positioning: string | null };
  evidence: RawEvidenceRow[];
  research: { whyContact: string; whyNow: string; whyPerson: string; potentialProblem: string; recommendedAngle: string; insufficient: boolean } | null;
  tone: Tone;
  includeNews: boolean;
  now: Date;
};

const HONORIFICS = new Set(["mr", "mrs", "ms", "miss", "dr", "prof", "sir"]);

export function firstNameOf(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/).filter((p) => !HONORIFICS.has(p.toLowerCase().replace(/\.$/, "")));
  const first = parts[0]?.replace(/[^\p{L}'’-]/gu, "") ?? "";
  return first.length > 0 ? first : null;
}

const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Pure: decides what is allowed through and why the rest was held back. Unit-tested table-style. */
export function assembleContext(raw: RawContext): PersonalizationContext {
  const notes: string[] = [];
  let withheldNews = 0;
  let stale = 0;
  const seen = new Set<string>();
  const kept: (ContextEvidence & { rank: number })[] = [];

  for (const e of raw.evidence) {
    if (!e.snippet.trim() || !e.sourceUrl) continue;
    const isNews = e.signalType !== null && NEWS_TYPES.has(e.signalType);
    if (isNews && !raw.includeNews) {
      withheldNews++;
      continue;
    }
    if (e.signalType !== null && e.detectedAt) {
      const ageDays = (raw.now.getTime() - new Date(e.detectedAt).getTime()) / DAY_MS;
      if (ageDays > (MAX_AGE_DAYS[e.signalType] ?? DEFAULT_MAX_AGE_DAYS)) {
        stale++;
        continue;
      }
    }
    const key = normKey(e.claim);
    if (seen.has(key)) continue;
    seen.add(key);
    // Signal-backed evidence is the "why now" material — it goes first; profile facts fill the rest.
    kept.push({
      id: e.id, claim: e.claim, snippet: e.snippet.slice(0, MAX_SNIPPET_CHARS), sourceUrl: e.sourceUrl, sourceTitle: e.sourceTitle,
      sourceType: e.sourceType, capturedAt: e.capturedAt, signalType: e.signalType, rank: e.signalType ? 0 : 1,
    });
  }
  kept.sort((a, b) => a.rank - b.rank || b.capturedAt.localeCompare(a.capturedAt) || a.id - b.id);
  const evidence = kept.slice(0, MAX_EVIDENCE).map((e) => ({
    id: e.id, claim: e.claim, snippet: e.snippet, sourceUrl: e.sourceUrl, sourceTitle: e.sourceTitle,
    sourceType: e.sourceType, capturedAt: e.capturedAt, signalType: e.signalType,
  }));

  if (withheldNews > 0) notes.push(`${withheldNews} news/funding item(s) were left out because “recent company news” is off.`);
  if (raw.includeNews && !evidence.some((e) => e.signalType !== null && NEWS_TYPES.has(e.signalType))) {
    notes.push("“Recent company news” is on, but no verified news or funding was found for this lead.");
  }
  if (stale > 0) notes.push(`${stale} item(s) were left out because they are too old to mention.`);
  if (evidence.length === 0) notes.push("No verified evidence is available — the email will be a short, honest, role-relevant note.");

  const r = raw.research;
  // The strategy narrative can quote withheld news; without the toggle we drop the "why now" line rather than risk it.
  const dropWhyNow = !raw.includeNews && withheldNews > 0;
  return {
    lead: { id: raw.lead.id, firstName: firstNameOf(raw.lead.fullName), fullName: raw.lead.fullName, title: raw.lead.title },
    company: { name: raw.company.name ?? "", domain: raw.company.domain, industry: raw.company.industry, description: raw.company.description },
    sender: { name: raw.sender.name, company: raw.sender.company, positioning: (raw.sender.positioning ?? "").trim() },
    evidence,
    strategy: r
      ? { ...r, whyNow: dropWhyNow ? "" : r.whyNow, insufficient: r.insufficient }
      : null,
    tone: raw.tone,
    includeNews: raw.includeNews,
    notes,
  };
}

export async function loadContext(
  workspaceId: number,
  userId: number | null,
  leadId: number,
  opts: { tone?: Tone; includeNews?: boolean } = {},
): Promise<PersonalizationContext> {
  const leadRows = await sql`
    select l.id, l.full_name, l.job_title, l.company, l.company_id,
           c.name as company_name, c.domain as company_domain, c.industry as company_industry, c.description as company_description
    from leads l
    left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
    where l.id = ${leadId} and l.workspace_id = ${workspaceId}
  `;
  if (leadRows.length === 0) throw new AppError("NOT_FOUND", "Lead not found.");
  const l = leadRows[0];
  const companyId = l.company_id === null ? null : Number(l.company_id);

  const [wsRows, userRows, evidenceRows, researchRows] = await Promise.all([
    sql`select company_name, positioning, tone from workspaces where id = ${workspaceId}`,
    userId ? sql`select name, company from users where id = ${userId}` : Promise.resolve([] as Record<string, unknown>[]),
    sql`
      select e.id, e.claim, e.snippet, e.source_url, e.source_title, e.source_type, e.captured_at,
             s.type as signal_type, s.detected_at
      from evidence e
      left join signals s on s.id = e.signal_id and s.workspace_id = e.workspace_id
      left join lead_research r on r.id = e.research_id and r.workspace_id = e.workspace_id
      where e.workspace_id = ${workspaceId} and e.verified
        and (e.lead_id = ${leadId} or (e.lead_id is null and e.company_id = ${companyId}::bigint))
        and (e.research_id is null or r.is_current)
        and (e.signal_id is null or (s.verified and s.is_current))
      order by e.id
    `,
    sql`
      select why_contact, why_now, why_person, potential_problem, recommended_angle, insufficient_evidence
      from lead_research where lead_id = ${leadId} and workspace_id = ${workspaceId} and is_current and status <> 'failed'
    `,
  ]);
  const ws = wsRows[0] ?? {};
  const u = userRows[0];
  const rs = researchRows[0];

  return assembleContext({
    lead: { id: leadId, fullName: String(l.full_name), title: (l.job_title as string | null) ?? null },
    company: {
      name: ((l.company_name as string | null) ?? (l.company as string | null)) || null,
      domain: (l.company_domain as string | null) ?? null,
      industry: (l.company_industry as string | null) ?? null,
      description: (l.company_description as string | null) ?? null,
    },
    sender: { name: (u?.name as string | undefined) ?? null, company: ((ws.company_name as string | null) ?? (u?.company as string | undefined) ?? null) || null, positioning: (ws.positioning as string | null) ?? null },
    evidence: evidenceRows.map((e) => ({
      id: Number(e.id), claim: String(e.claim), snippet: String(e.snippet), sourceUrl: String(e.source_url),
      sourceTitle: (e.source_title as string | null) ?? null, sourceType: String(e.source_type),
      capturedAt: new Date(String(e.captured_at)).toISOString(),
      signalType: (e.signal_type as string | null) ?? null, detectedAt: dateOnly(e.detected_at),
    })),
    research: rs
      ? {
          whyContact: String(rs.why_contact), whyNow: String(rs.why_now), whyPerson: String(rs.why_person),
          potentialProblem: String(rs.potential_problem), recommendedAngle: String(rs.recommended_angle), insufficient: Boolean(rs.insufficient_evidence),
        }
      : null,
    tone: opts.tone ?? (isTone(ws.tone) ? ws.tone : "concise"),
    includeNews: opts.includeNews ?? false,
    now: new Date(),
  });
}
