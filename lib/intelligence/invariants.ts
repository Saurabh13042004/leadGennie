import type { EngineResearchResult } from "./schemas";

/**
 * Defensive re-check of the engine's contract invariants (mirror of services/intelligence/app/contracts/invariants.py).
 * The engine enforces them too; we never rely on that. A payload that violates any of them is QUARANTINED:
 * nothing from it is written. Returns the list of violations (empty = safe to persist).
 *
 * Rules: every evidence reference resolves; every claim-bearing item has evidence; a verified signal rests only on
 * verified evidence; the outreach narrative and every score point rest only on VERIFIED evidence/signals.
 */
export function checkInvariants(result: EngineResearchResult): string[] {
  const problems: string[] = [];
  const evidence = new Map(result.evidence.map((e) => [e.id, e]));
  if (evidence.size !== result.evidence.length) problems.push("duplicate evidence ids");

  const resolves = (owner: string, ids: string[]) => {
    for (const id of ids) if (!evidence.has(id)) problems.push(`${owner}: evidence id "${id}" does not resolve`);
  };

  for (const f of result.company.fields) {
    resolves(`company.fields[${f.field}]`, f.evidence_ids);
    if (f.evidence_ids.length === 0) problems.push(`company.fields[${f.field}]: field without evidence`);
    else if (!f.evidence_ids.every((id) => evidence.get(id)?.verification.verified)) problems.push(`company.fields[${f.field}]: rests on unverified evidence`);
  }
  for (const p of result.people) {
    resolves(`people[${p.name}]`, p.evidence_ids);
    if (p.evidence_ids.length === 0) problems.push(`people[${p.name}]: person without evidence`);
  }

  const signalIds = new Set<string>();
  for (const s of result.signals) {
    if (signalIds.has(s.id)) problems.push(`duplicate signal id ${s.id}`);
    signalIds.add(s.id);
    resolves(`signals[${s.id}]`, s.evidence_ids);
    if (s.evidence_ids.length === 0) problems.push(`signals[${s.id}]: signal without evidence`);
    if (s.verified && !s.evidence_ids.every((id) => evidence.get(id)?.verification.verified)) {
      problems.push(`signals[${s.id}]: verified signal references unverified evidence`);
    }
  }

  resolves("outreach", result.outreach.evidence_ids);
  for (const id of result.outreach.evidence_ids) {
    if (evidence.has(id) && !evidence.get(id)!.verification.verified) problems.push(`outreach: references unverified evidence "${id}"`);
  }

  for (const item of result.icp.breakdown) {
    resolves(`icp[${item.criterion}]`, item.evidence_ids);
    if (item.points > 0 && item.evidence_ids.some((id) => evidence.get(id) && !evidence.get(id)!.verification.verified)) {
      problems.push(`icp[${item.criterion}]: points awarded from unverified evidence`);
    }
  }
  const unverified = new Set(result.signals.filter((s) => !s.verified).map((s) => s.id));
  for (const i of result.intent.breakdown) {
    if (i.signal_id && unverified.has(i.signal_id) && i.points > 0) problems.push(`intent: points awarded from unverified signal "${i.signal_id}"`);
    if (i.signal_id && !signalIds.has(i.signal_id)) problems.push(`intent: signal "${i.signal_id}" does not exist`);
  }
  for (const w of result.why_fit) resolves(`why_fit[${w.criterion}]`, w.evidence_ids);
  return problems;
}
