import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { checkInvariants } from "./invariants";
import type { EngineResearchResult } from "./schemas";

/**
 * Persistence of an engine Research Result — THE single writer of research/signals/evidence/scores (rule X1).
 *
 *  1. Re-check the contract invariants; a violating payload is QUARANTINED (nothing is written).
 *  2. Pre-allocate database ids so every cross-reference (signal ↔ evidence, score breakdown → evidence, provenance)
 *     is a real id, not an engine-local one.
 *  3. Write everything in ONE transaction: history is never edited — the previous research/signals flip to
 *     is_current = false and new rows are inserted.
 *
 * Enrichment only fills BLANKS on the company/lead and records provenance; a value a user entered is never
 * overwritten (source = 'engine' is the weakest source).
 */

export class QuarantineError extends Error {
  constructor(readonly problems: string[]) {
    super(`Engine result failed validation: ${problems.slice(0, 3).join("; ")}${problems.length > 3 ? ` (+${problems.length - 3} more)` : ""}`);
    this.name = "QuarantineError";
  }
}

export type PersistInput = {
  workspaceId: number;
  userId: number | null;
  /** Null for company-level research (no lead_research row, no lead score). */
  leadId: number | null;
  companyId: number | null;
  agentRunId: number | null;
  engineRunId: string;
  contractVersion: string;
  result: EngineResearchResult;
};

export type PersistOutcome = {
  researchId: number | null;
  status: "complete" | "partial";
  evidence: number;
  signals: number;
  verifiedSignals: number;
  fieldsWritten: string[];
  fieldsKeptAsSuggestion: string[];
  candidates: number;
};

type IdTable = "evidence" | "signals" | "lead_research";

async function allocateIds(table: IdTable, n: number): Promise<number[]> {
  if (n <= 0) return [];
  const rows = await sql`select nextval(pg_get_serial_sequence(${table}, 'id')) as id from generate_series(1, ${n})`;
  return rows.map((r) => Number(r.id));
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

export async function persistResearch(input: PersistInput): Promise<PersistOutcome> {
  const { result, workspaceId, leadId } = input;

  const problems = checkInvariants(result);
  if (problems.length > 0) throw new QuarantineError(problems);

  // Everything below is scoped by the workspace: an id from a job payload is never trusted on its own.
  const leadRows = leadId
    ? await sql`select id, full_name, job_title, company_id from leads where id = ${leadId} and workspace_id = ${workspaceId}`
    : [];
  if (leadId && leadRows.length === 0) throw new AppError("NOT_FOUND", "Lead not found (it may have been deleted).");
  const lead = leadRows[0] ?? null;
  const companyId = input.companyId ?? (lead?.company_id ? Number(lead.company_id) : null);
  const companyRows = companyId
    ? await sql`select id, industry, employee_count, location, description from companies where id = ${companyId} and workspace_id = ${workspaceId}`
    : [];
  const company = companyRows[0] ?? null;
  const scopedCompanyId = company ? Number(company.id) : null;
  if (leadId === null && scopedCompanyId === null) throw new AppError("NOT_FOUND", "Nothing to attach the research to.");

  // ---- ids ---------------------------------------------------------------------------------------------
  const [evIds, sgIds, rsIds] = await Promise.all([
    allocateIds("evidence", result.evidence.length),
    allocateIds("signals", result.signals.length),
    allocateIds("lead_research", leadId ? 1 : 0),
  ]);
  const evId = new Map(result.evidence.map((e, i) => [e.id, evIds[i]]));
  const sgId = new Map(result.signals.map((s, i) => [s.id, sgIds[i]]));
  const researchId = rsIds[0] ?? null;
  const mapEv = (ids: string[]) => ids.map((i) => evId.get(i)).filter((x): x is number => x !== undefined);

  // The evidence that backs a signal points at it (each evidence row supports one claim).
  const signalOfEvidence = new Map<string, number>();
  for (const s of result.signals) for (const e of s.evidence_ids) if (!signalOfEvidence.has(e)) signalOfEvidence.set(e, sgId.get(s.id)!);

  const evidenceRows = result.evidence.map((e) => ({
    id: evId.get(e.id),
    lead_id: leadId,
    company_id: scopedCompanyId,
    signal_id: signalOfEvidence.get(e.id) ?? null,
    research_id: researchId,
    claim: e.claim,
    source_url: e.source_url,
    source_title: e.source_title ?? null,
    source_type: e.source_type,
    snippet: e.snippet,
    content_hash: e.content_hash,
    captured_at: e.captured_at,
    verified: e.verification.verified,
    verification: e.verification,
    engine_evidence_id: e.id,
    engine_run_id: input.engineRunId,
  }));

  const signalRows = result.signals.map((s) => ({
    id: sgId.get(s.id),
    lead_id: leadId,
    company_id: scopedCompanyId,
    research_id: researchId,
    type: s.type,
    title: s.title,
    description: s.description,
    detected_at: s.detected_at ? s.detected_at.slice(0, 10) : null,
    confidence: s.confidence,
    verified: s.verified,
    conflicts_with: s.conflicts_with.map((c) => sgId.get(c)).filter((x): x is number => x !== undefined),
    engine_signal_id: s.id,
  }));

  const partial = result.warnings.some((w) => w.startsWith("budget_exhausted"));
  const status: "complete" | "partial" = partial ? "partial" : "complete";

  const researchRow = researchId
    ? {
        id: researchId,
        lead_id: leadId,
        company_id: scopedCompanyId,
        status,
        why_contact: result.outreach.why_contact,
        why_now: result.outreach.why_now,
        why_person: result.outreach.why_person,
        potential_problem: result.outreach.potential_problem,
        recommended_angle: result.outreach.recommended_angle,
        insufficient_evidence: result.outreach.insufficient_evidence,
        icp_score: result.icp.score,
        icp_confidence: result.icp.confidence,
        icp_breakdown: result.icp.breakdown.map((b) => ({ ...b, evidence_ids: mapEv(b.evidence_ids) })),
        intent_breakdown: result.intent.breakdown.map((b) => ({ ...b, signal_id: b.signal_id ? (sgId.get(b.signal_id) ?? null) : null })),
        why_fit: result.why_fit.map((w) => ({ ...w, evidence_ids: mapEv(w.evidence_ids) })),
        scoring_inputs: result.scoring_inputs,
        scoring_version: result.scoring_version,
        qualified: result.qualified,
        evidence_ids: mapEv(result.outreach.evidence_ids),
        unknowns: result.unknowns,
        warnings: result.warnings,
        engine_run_id: input.engineRunId,
        engine_contract_version: input.contractVersion,
        agent_run_id: input.agentRunId,
      }
    : null;

  // ---- enrichment: fill blanks only, record provenance ------------------------------------------------------
  const fieldValue = (name: string) => result.company.fields.find((f) => f.field === name);
  const wanted: { name: "industry" | "employee_count" | "location" | "description"; value: string | number | null | undefined; column: string }[] = [
    { name: "industry", value: result.company.industry, column: "industry" },
    { name: "employee_count", value: parseCount(fieldValue("employee_count")?.value), column: "employee_count" },
    { name: "location", value: result.company.location, column: "location" },
    { name: "description", value: result.company.description, column: "description" },
  ];
  const fieldsWritten: string[] = [];
  const fieldsKept: string[] = [];
  const companySet: Record<string, string | number> = {};
  const provenance: Record<string, unknown>[] = [];
  if (company) {
    for (const w of wanted) {
      if (blank(w.value)) continue;
      // Rule 6: a value is only written to the company if the engine backed it with (verified) evidence.
      const evidenceId = mapEv(fieldValue(w.name)?.evidence_ids ?? [])[0] ?? null;
      if (evidenceId === null) continue;
      if (blank(company[w.column])) {
        companySet[w.column] = w.value as string | number;
        fieldsWritten.push(`company.${w.name}`);
        provenance.push({ entity_type: "company", entity_id: scopedCompanyId, field: w.name, value: String(w.value), source: "engine", evidence_id: evidenceId, confidence: evidenceConfidence(result, fieldValue(w.name)?.evidence_ids), set_by: "job" });
      } else if (String(company[w.column]).trim().toLowerCase() !== String(w.value).trim().toLowerCase()) {
        fieldsKept.push(`company.${w.name}`); // a differing value already exists: never overwritten, surfaced as a suggestion
      }
    }
  }
  let newTitle: string | null = null;
  if (lead && blank(lead.job_title)) {
    const match = result.people.find((p) => p.title && p.name.trim().toLowerCase() === String(lead.full_name).trim().toLowerCase());
    if (match?.title) {
      newTitle = match.title;
      fieldsWritten.push("lead.job_title");
      provenance.push({ entity_type: "lead", entity_id: leadId, field: "job_title", value: match.title, source: "engine", evidence_id: mapEv(match.evidence_ids)[0] ?? null, confidence: evidenceConfidence(result, match.evidence_ids), set_by: "job" });
    }
  }

  const leadName = lead ? String(lead.full_name).trim().toLowerCase() : "";
  const candidates = result.people
    .filter((p) => p.name.trim().toLowerCase() !== leadName)
    .map((p) => ({ name: p.name, title: p.title ?? null, relevance: p.relevance, evidence_ids: mapEv(p.evidence_ids) }));

  // ---- one atomic write --------------------------------------------------------------------------------------
  const J = (v: unknown) => JSON.stringify(v);
  const statements = [
    leadId
      ? sql`update lead_research set is_current = false where lead_id = ${leadId} and workspace_id = ${workspaceId} and is_current`
      : sql`update signals set is_current = false where company_id = ${scopedCompanyId} and lead_id is null and workspace_id = ${workspaceId} and is_current`,
    leadId
      ? sql`update signals set is_current = false where lead_id = ${leadId} and workspace_id = ${workspaceId} and is_current`
      : sql`select 1`,
    researchRow
      ? sql`
          insert into lead_research (id, workspace_id, lead_id, company_id, status, why_contact, why_now, why_person, potential_problem, recommended_angle,
            insufficient_evidence, icp_score, icp_confidence, icp_breakdown, intent_breakdown, why_fit, scoring_inputs, scoring_version, qualified,
            evidence_ids, unknowns, warnings, engine_run_id, engine_contract_version, agent_run_id)
          select x.id, ${workspaceId}, x.lead_id, x.company_id, x.status, x.why_contact, x.why_now, x.why_person, x.potential_problem, x.recommended_angle,
            x.insufficient_evidence, x.icp_score, x.icp_confidence, x.icp_breakdown, x.intent_breakdown, x.why_fit, x.scoring_inputs, x.scoring_version, x.qualified,
            x.evidence_ids, x.unknowns, x.warnings, x.engine_run_id, x.engine_contract_version, x.agent_run_id
          from jsonb_to_recordset(${J([researchRow])}::jsonb) as x(
            id bigint, lead_id bigint, company_id bigint, status text, why_contact text, why_now text, why_person text, potential_problem text,
            recommended_angle text, insufficient_evidence boolean, icp_score int, icp_confidence numeric, icp_breakdown jsonb, intent_breakdown jsonb,
            why_fit jsonb, scoring_inputs jsonb, scoring_version text, qualified boolean, evidence_ids bigint[], unknowns jsonb, warnings jsonb,
            engine_run_id text, engine_contract_version text, agent_run_id bigint)`
      : sql`select 1`,
    signalRows.length
      ? sql`
          insert into signals (id, workspace_id, lead_id, company_id, research_id, type, title, description, detected_at, confidence, verified, conflicts_with, engine_signal_id)
          select x.id, ${workspaceId}, x.lead_id, x.company_id, x.research_id, x.type, x.title, x.description, x.detected_at, x.confidence, x.verified, coalesce(x.conflicts_with, '{}'), x.engine_signal_id
          from jsonb_to_recordset(${J(signalRows)}::jsonb) as x(
            id bigint, lead_id bigint, company_id bigint, research_id bigint, type text, title text, description text, detected_at date,
            confidence numeric, verified boolean, conflicts_with bigint[], engine_signal_id text)`
      : sql`select 1`,
    evidenceRows.length
      ? sql`
          insert into evidence (id, workspace_id, lead_id, company_id, signal_id, research_id, claim, source_url, source_title, source_type, snippet, content_hash,
            captured_at, verified, verification, engine_evidence_id, engine_run_id)
          select x.id, ${workspaceId}, x.lead_id, x.company_id, x.signal_id, x.research_id, x.claim, x.source_url, x.source_title, x.source_type, x.snippet, x.content_hash,
            x.captured_at, x.verified, x.verification, x.engine_evidence_id, x.engine_run_id
          from jsonb_to_recordset(${J(evidenceRows)}::jsonb) as x(
            id bigint, lead_id bigint, company_id bigint, signal_id bigint, research_id bigint, claim text, source_url text, source_title text, source_type text,
            snippet text, content_hash text, captured_at timestamptz, verified boolean, verification jsonb, engine_evidence_id text, engine_run_id text)`
      : sql`select 1`,
    provenance.length
      ? sql`
          insert into field_provenance (workspace_id, entity_type, entity_id, field, value, source, evidence_id, confidence, set_by)
          select ${workspaceId}, x.entity_type, x.entity_id, x.field, x.value, x.source, x.evidence_id, x.confidence, x.set_by
          from jsonb_to_recordset(${J(provenance)}::jsonb) as x(
            entity_type text, entity_id bigint, field text, value text, source text, evidence_id bigint, confidence numeric, set_by text)`
      : sql`select 1`,
    candidates.length
      ? sql`
          insert into prospect_candidates (workspace_id, company_id, source_lead_id, name, title, relevance, evidence_ids, agent_run_id)
          select ${workspaceId}, ${scopedCompanyId}, ${leadId}, x.name, x.title, x.relevance, x.evidence_ids, ${input.agentRunId}
          from jsonb_to_recordset(${J(candidates)}::jsonb) as x(name text, title text, relevance text, evidence_ids bigint[])
          on conflict (workspace_id, coalesce(company_id, 0), lower(name), coalesce(lower(title), '')) do nothing`
      : sql`select 1`,
    scopedCompanyId
      ? sql`
          update companies set
            industry = coalesce(${(companySet.industry as string | undefined) ?? null}, industry),
            employee_count = coalesce(${(companySet.employee_count as number | undefined) ?? null}::int, employee_count),
            location = coalesce(${(companySet.location as string | undefined) ?? null}, location),
            description = coalesce(${(companySet.description as string | undefined) ?? null}, description),
            researched_at = now(), updated_at = now()
          where id = ${scopedCompanyId} and workspace_id = ${workspaceId}`
      : sql`select 1`,
    leadId
      ? sql`
          update leads set icp_score = ${result.icp.score}, intent_score = ${result.intent.score}, scoring_version = ${result.scoring_version},
            qualified = ${result.qualified}, research_status = ${partial ? "partial" : "done"}, researched_at = now(), updated_at = now(),
            job_title = coalesce(${newTitle}, job_title)
          where id = ${leadId} and workspace_id = ${workspaceId}`
      : sql`select 1`,
  ];
  await sql.transaction(statements);

  await logActivity({
    workspaceId,
    actorUserId: input.userId,
    type: leadId ? "lead.researched" : "company.researched",
    entityType: leadId ? "lead" : "company",
    entityId: leadId ?? scopedCompanyId,
    summary: `Research ${status}: ICP ${result.icp.score}, ${result.signals.filter((s) => s.verified).length} verified signal(s), ${result.evidence.length} source(s)`,
    metadata: { engine_run_id: input.engineRunId, warnings: result.warnings.slice(0, 10) },
  });

  return {
    researchId,
    status,
    evidence: result.evidence.length,
    signals: result.signals.length,
    verifiedSignals: result.signals.filter((s) => s.verified).length,
    fieldsWritten,
    fieldsKeptAsSuggestion: fieldsKept,
    candidates: candidates.length,
  };
}

function parseCount(value: string | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : null;
}

function evidenceConfidence(result: EngineResearchResult, ids: string[] | undefined): number | null {
  const first = ids?.map((i) => result.evidence.find((e) => e.id === i)).find(Boolean);
  return first ? first.verification.confidence : null;
}
