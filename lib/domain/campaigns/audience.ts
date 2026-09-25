import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { getLeadsInCooldown } from "@/lib/compliance";
import { classifyEmail } from "@/lib/domain/leads/email";
import { fetchMatchingLeads, hasStructuredCriteria, normalize, type FilterCriteria } from "@/lib/db/lead-matching";
import { OCCUPYING } from "./state-machine";
import { EXCLUSION_REASONS, type AudienceDefinition, type ExclusionReason } from "./types";

const OCCUPYING_SQL = OCCUPYING.map((s) => `'${s}'`).join(", ");

/**
 * Audience resolution (WP4.4) — the same rules the sender applies, applied at build time, with every exclusion
 * COUNTED and shown rather than silently dropped. Used by the builder's live count, by submit-for-approval and
 * again at launch (enrollment), so what was approved is re-checked against today's suppressions.
 */

/** A builder audience is bounded: it keeps resolution fast and bulk personalization affordable. */
export const MAX_AUDIENCE = 1000;

export type AudienceCandidate = {
  id: number;
  fullName: string;
  email: string | null;
  company: string | null;
  emailStatus: string | null;
  researchStatus: string | null;
  icpScore: number | null;
  qualified: boolean | null;
};

/** Facts about the candidates that come from other tables (suppression lists, other campaigns, send history). */
export type AudienceFacts = {
  /** lower(email) → where the suppression came from. */
  suppressed: Map<string, "do_not_contact" | "unsubscribed" | "bounced">;
  cooldown: Set<number>;
  inOtherCampaign: Set<number>;
};

export type AudienceResolution = {
  candidates: number;
  eligible: AudienceCandidate[];
  exclusions: Record<ExclusionReason, number>;
  /** A few examples per reason, so the builder can show *who* was excluded, not just how many. */
  samples: Partial<Record<ExclusionReason, { id: number; name: string }[]>>;
  /** Every excluded lead id, by reason (bounded by MAX_AUDIENCE) — launch records them per lead. */
  excludedIds: Partial<Record<ExclusionReason, number[]>>;
  /** True when the source had more leads than MAX_AUDIENCE and only the first MAX_AUDIENCE were considered. */
  capped: boolean;
  notes: string[];
};

const emptyCounts = () => Object.fromEntries(EXCLUSION_REASONS.map((r) => [r, 0])) as Record<ExclusionReason, number>;

/** Pure: which reason (if any) keeps this lead out. Precedence follows EXCLUSION_REASONS. */
export function exclusionFor(c: AudienceCandidate, facts: AudienceFacts, filters: AudienceDefinition["filters"]): ExclusionReason | null {
  if (!c.email || !c.email.trim()) return "no_email";
  const cls = classifyEmail(c.email);
  if (cls.status === "invalid" || c.emailStatus === "invalid") return "invalid_email";
  const suppression = facts.suppressed.get(c.email.trim().toLowerCase());
  if (suppression) return suppression;
  if (!filters.includeRiskyEmails && (cls.status === "risky" || c.emailStatus === "risky")) return "risky_email";
  if (facts.cooldown.has(c.id)) return "cooldown";
  if (facts.inOtherCampaign.has(c.id)) return "in_other_campaign";
  const researched = c.researchStatus === "done" || c.researchStatus === "partial";
  if ((filters.requireResearched || filters.minIcpScore !== null || filters.qualifiedOnly) && !researched) return "unresearched";
  if (filters.minIcpScore !== null && (c.icpScore === null || c.icpScore < filters.minIcpScore)) return "below_icp_score";
  if (filters.qualifiedOnly && c.qualified !== true) return "not_qualified";
  return null;
}

/** Pure: split candidates into eligible + counted exclusions. */
export function classifyAudience(candidates: AudienceCandidate[], facts: AudienceFacts, def: AudienceDefinition): Omit<AudienceResolution, "capped" | "notes"> {
  const exclusions = emptyCounts();
  const samples: AudienceResolution["samples"] = {};
  const excludedIds: AudienceResolution["excludedIds"] = {};
  const eligible: AudienceCandidate[] = [];
  const seen = new Set<string>();
  for (const c of candidates) {
    let reason = exclusionFor(c, facts, def.filters);
    // Two leads with the same address would be emailed twice; the second is treated as already enrolled.
    const key = c.email?.trim().toLowerCase();
    if (!reason && key) {
      if (seen.has(key)) reason = "in_other_campaign";
      else seen.add(key);
    }
    if (reason) {
      exclusions[reason]++;
      const list = (samples[reason] ??= []);
      if (list.length < 5) list.push({ id: c.id, name: c.fullName });
      (excludedIds[reason] ??= []).push(c.id);
    } else {
      eligible.push(c);
    }
  }
  return { candidates: candidates.length, eligible, exclusions, samples, excludedIds };
}

const toCandidate = (r: Record<string, unknown>): AudienceCandidate => ({
  id: Number(r.id),
  fullName: String(r.full_name),
  email: (r.email as string | null) ?? null,
  company: (r.company_name as string | null) ?? (r.company as string | null) ?? null,
  emailStatus: (r.email_status as string | null) ?? null,
  researchStatus: (r.research_status as string | null) ?? null,
  icpScore: r.icp_score === null || r.icp_score === undefined ? null : Number(r.icp_score),
  qualified: r.qualified === null || r.qualified === undefined ? null : Boolean(r.qualified),
});

async function loadCandidates(workspaceId: number, def: AudienceDefinition): Promise<{ rows: AudienceCandidate[]; capped: boolean; notes: string[] }> {
  const notes: string[] = [];
  let ids: number[] | null = null;
  if (def.source === "leads") {
    ids = [...new Set(def.leadIds)];
    if (ids.length === 0) return { rows: [], capped: false, notes: ["No leads selected."] };
  } else if (def.source === "segment") {
    if (!def.segmentId) throw new AppError("VALIDATION_ERROR", "Pick a saved segment.");
    const seg = await sql`select criteria from segments where id = ${def.segmentId} and workspace_id = ${workspaceId}`;
    if (seg.length === 0) throw new AppError("NOT_FOUND", "That segment no longer exists.");
    const criteria = normalize(seg[0].criteria as Partial<FilterCriteria>);
    // Unlike the legacy wizard, a segment that matches nothing is NOT widened to "all leads".
    if (!hasStructuredCriteria(criteria)) return { rows: [], capped: false, notes: ["This segment has no filters that match leads, so it selects nobody."] };
    const matched = await fetchMatchingLeads(workspaceId, criteria, MAX_AUDIENCE + 1);
    ids = matched.map((m) => Number(m.id));
    if (ids.length === 0) return { rows: [], capped: false, notes: ["No leads currently match this segment."] };
  }

  const rows = ids
    ? await sql`
        select l.id, l.full_name, l.email, l.company, l.email_status, l.research_status, l.icp_score, l.qualified, c.name as company_name
        from leads l left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
        where l.workspace_id = ${workspaceId} and l.id = any(${ids}::bigint[])
        order by l.id limit ${MAX_AUDIENCE + 1}`
    : await sql`
        select l.id, l.full_name, l.email, l.company, l.email_status, l.research_status, l.icp_score, l.qualified, c.name as company_name
        from leads l left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id
        where l.workspace_id = ${workspaceId}
        order by l.id limit ${MAX_AUDIENCE + 1}`;
  const capped = rows.length > MAX_AUDIENCE;
  if (capped) notes.push(`Only the first ${MAX_AUDIENCE} leads are included. Narrow the audience to reach the rest.`);
  if (def.source === "leads" && ids && rows.length < ids.length) notes.push(`${ids.length - rows.length} selected lead(s) no longer exist.`);
  return { rows: rows.slice(0, MAX_AUDIENCE).map(toCandidate), capped, notes };
}

async function loadFacts(workspaceId: number, candidates: AudienceCandidate[], excludeCampaignId: number | null): Promise<AudienceFacts> {
  const ids = candidates.map((c) => c.id);
  if (ids.length === 0) return { suppressed: new Map(), cooldown: new Set(), inOtherCampaign: new Set() };
  const emails = [...new Set(candidates.map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => !!e))];
  const [dnc, cooldown, occupied] = await Promise.all([
    emails.length
      ? sql`select lower(email) as email, source, reason from do_not_contact where workspace_id = ${workspaceId} and lower(email) = any(${emails}::text[])`
      : Promise.resolve([] as Record<string, unknown>[]),
    getLeadsInCooldown(workspaceId, ids),
    sql.query(
      `select cl.lead_id from campaign_leads cl
         join campaigns c on c.id = cl.campaign_id and c.workspace_id = cl.workspace_id
       where cl.workspace_id = $1 and cl.lead_id = any($2::bigint[]) and cl.status in ('pending', 'active')
         and c.status in (${OCCUPYING_SQL}) and c.id <> $3
       union
       select cs.lead_id from campaign_sends cs
         join campaigns c on c.id = cs.campaign_id and c.workspace_id = cs.workspace_id
       where cs.workspace_id = $1 and cs.lead_id = any($2::bigint[]) and cs.status = 'pending'
         and c.status in ('running', 'paused') and c.send_model = 'legacy' and c.id <> $3`,
      [workspaceId, ids, excludeCampaignId ?? 0],
    ),
  ]);
  const suppressed: AudienceFacts["suppressed"] = new Map();
  for (const d of dnc) {
    const source = String(d.source);
    const reason = String(d.reason ?? "").toLowerCase();
    suppressed.set(
      String(d.email),
      source === "unsubscribe_link" ? "unsubscribed" : source === "resend_webhook" || /bounce|complain|spam/.test(reason) ? "bounced" : "do_not_contact",
    );
  }
  return { suppressed, cooldown, inOtherCampaign: new Set(occupied.map((r) => Number(r.lead_id))) };
}

export async function resolveAudience(
  workspaceId: number,
  def: AudienceDefinition,
  opts: { excludeCampaignId?: number | null } = {},
): Promise<AudienceResolution> {
  const { rows, capped, notes } = await loadCandidates(workspaceId, def);
  const facts = await loadFacts(workspaceId, rows, opts.excludeCampaignId ?? null);
  return { ...classifyAudience(rows, facts, def), capped, notes };
}
