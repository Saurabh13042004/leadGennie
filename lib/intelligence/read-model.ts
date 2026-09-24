import { sql } from "@/lib/db/client";

/** What the lead detail page shows. Verified and unverified items are returned separately — the UI never mixes them. */

export type EvidenceView = {
  id: number;
  claim: string;
  sourceUrl: string;
  sourceTitle: string | null;
  sourceType: string;
  snippet: string;
  capturedAt: string;
  verified: boolean;
  confidence: number;
  notes: string[];
  signalId: number | null;
};

export type SignalView = {
  id: number;
  type: string;
  title: string;
  description: string;
  detectedAt: string | null;
  confidence: number;
  verified: boolean;
  conflictsWith: number[];
  evidence: EvidenceView[];
};

export type CriterionView = { criterion: string; status: "met" | "partial" | "not_met" | "unknown"; text: string; evidenceIds: number[] };

export type LeadIntelligence = {
  leadId: number;
  researchStatus: string;
  researchedAt: string | null;
  icpScore: number | null;
  intentScore: number | null;
  qualified: boolean | null;
  /** Why the latest research failed (only set while research_status = 'failed'). */
  lastError: string | null;
  research: {
    id: number;
    status: string;
    icpConfidence: number | null;
    whyContact: string;
    whyNow: string;
    whyPerson: string;
    potentialProblem: string;
    recommendedAngle: string;
    insufficientEvidence: boolean;
    whyFit: CriterionView[];
    unknowns: string[];
    warnings: string[];
    evidenceIds: number[];
    createdAt: string;
  } | null;
  verifiedSignals: SignalView[];
  unverifiedSignals: SignalView[];
  /** Verified evidence that isn't attached to a signal (profile facts, people). */
  otherEvidence: EvidenceView[];
  verifiedSourceCount: number;
  company: { id: number; name: string; domain: string | null; industry: string | null; employeeCount: number | null; location: string | null; description: string | null } | null;
  candidates: { id: number; name: string; title: string | null; relevance: string }[];
  history: { id: number; createdAt: string; icpScore: number | null; status: string }[];
};

const toEvidence = (r: Record<string, unknown>): EvidenceView => {
  const v = (r.verification ?? {}) as { confidence?: number; notes?: string[] };
  return {
    id: Number(r.id), claim: String(r.claim), sourceUrl: String(r.source_url), sourceTitle: (r.source_title as string | null) ?? null,
    sourceType: String(r.source_type), snippet: String(r.snippet), capturedAt: new Date(String(r.captured_at)).toISOString(),
    verified: Boolean(r.verified), confidence: Number(v.confidence ?? 0), notes: v.notes ?? [],
    signalId: r.signal_id === null || r.signal_id === undefined ? null : Number(r.signal_id),
  };
};

export async function getLeadIntelligence(workspaceId: number, leadId: number): Promise<LeadIntelligence | null> {
  const leadRows = await sql`
    select id, research_status, researched_at, icp_score, intent_score, qualified, company_id
    from leads where id = ${leadId} and workspace_id = ${workspaceId}
  `;
  if (leadRows.length === 0) return null;
  const lead = leadRows[0];

  const failed = String(lead.research_status) === "failed";
  const [researchRows, signalRows, evidenceRows, companyRows, candidateRows, historyRows, errorRows] = await Promise.all([
    sql`select * from lead_research where lead_id = ${leadId} and workspace_id = ${workspaceId} and is_current`,
    sql`select * from signals where lead_id = ${leadId} and workspace_id = ${workspaceId} and is_current order by verified desc, detected_at desc nulls last, id`,
    sql`
      select e.* from evidence e
      join lead_research r on r.id = e.research_id and r.workspace_id = e.workspace_id and r.is_current
      where e.lead_id = ${leadId} and e.workspace_id = ${workspaceId} order by e.id`,
    lead.company_id
      ? sql`select id, name, domain, industry, employee_count, location, description from companies where id = ${Number(lead.company_id)} and workspace_id = ${workspaceId}`
      : Promise.resolve([] as Record<string, unknown>[]),
    lead.company_id
      ? sql`select id, name, title, relevance from prospect_candidates where workspace_id = ${workspaceId} and company_id = ${Number(lead.company_id)} and status = 'suggested' order by id limit 10`
      : Promise.resolve([] as Record<string, unknown>[]),
    sql`select id, created_at, icp_score, status from lead_research where lead_id = ${leadId} and workspace_id = ${workspaceId} order by created_at desc limit 10`,
    failed
      ? sql`select error from jobs where workspace_id = ${workspaceId} and type = 'lead_research' and payload->>'leadId' = ${String(leadId)} and status = 'dead' order by id desc limit 1`
      : Promise.resolve([] as Record<string, unknown>[]),
  ]);

  const evidence = evidenceRows.map(toEvidence);
  const signals: SignalView[] = signalRows.map((s) => ({
    id: Number(s.id), type: String(s.type), title: String(s.title), description: String(s.description ?? ""),
    detectedAt: s.detected_at ? String(s.detected_at).slice(0, 10) : null, confidence: Number(s.confidence), verified: Boolean(s.verified),
    conflictsWith: ((s.conflicts_with ?? []) as unknown[]).map(Number),
    evidence: evidence.filter((e) => e.signalId === Number(s.id)),
  }));
  const r = researchRows[0];
  const c = companyRows[0];

  return {
    leadId,
    researchStatus: String(lead.research_status),
    researchedAt: lead.researched_at ? new Date(String(lead.researched_at)).toISOString() : null,
    icpScore: lead.icp_score === null ? null : Number(lead.icp_score),
    intentScore: lead.intent_score === null ? null : Number(lead.intent_score),
    qualified: lead.qualified === null ? null : Boolean(lead.qualified),
    lastError: (errorRows[0]?.error as string | undefined) ?? null,
    research: r
      ? {
          id: Number(r.id), status: String(r.status), icpConfidence: r.icp_confidence === null ? null : Number(r.icp_confidence),
          whyContact: String(r.why_contact), whyNow: String(r.why_now), whyPerson: String(r.why_person),
          potentialProblem: String(r.potential_problem), recommendedAngle: String(r.recommended_angle),
          insufficientEvidence: Boolean(r.insufficient_evidence),
          whyFit: ((r.why_fit ?? []) as { criterion: string; status: CriterionView["status"]; text: string; evidence_ids: number[] }[]).map((w) => ({
            criterion: w.criterion, status: w.status, text: w.text, evidenceIds: w.evidence_ids ?? [],
          })),
          unknowns: (r.unknowns ?? []) as string[], warnings: (r.warnings ?? []) as string[],
          evidenceIds: ((r.evidence_ids ?? []) as unknown[]).map(Number), createdAt: new Date(String(r.created_at)).toISOString(),
        }
      : null,
    verifiedSignals: signals.filter((s) => s.verified),
    unverifiedSignals: signals.filter((s) => !s.verified),
    otherEvidence: evidence.filter((e) => e.signalId === null),
    verifiedSourceCount: new Set(evidence.filter((e) => e.verified).map((e) => e.sourceUrl)).size,
    company: c
      ? { id: Number(c.id), name: String(c.name), domain: (c.domain as string | null) ?? null, industry: (c.industry as string | null) ?? null,
          employeeCount: c.employee_count === null ? null : Number(c.employee_count), location: (c.location as string | null) ?? null,
          description: (c.description as string | null) ?? null }
      : null,
    candidates: candidateRows.map((p) => ({ id: Number(p.id), name: String(p.name), title: (p.title as string | null) ?? null, relevance: String(p.relevance) })),
    history: historyRows.map((h) => ({ id: Number(h.id), createdAt: new Date(String(h.created_at)).toISOString(), icpScore: h.icp_score === null ? null : Number(h.icp_score), status: String(h.status) })),
  };
}
