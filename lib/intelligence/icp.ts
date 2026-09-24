import type { Icp } from "@/lib/domain/workspace/icp";
import type { EngineIcp } from "./schemas";

/**
 * The workspace ICP (plain, human-editable lists + scoring weights) → the engine's weighted scoring schema.
 * Values stay free text ("India", "cto", "Tech / Software"): the engine normalizes them against its own taxonomy
 * (single implementation — nothing is duplicated here). Deterministic: same ICP ⇒ same engine ICP.
 */
export function toEngineIcp(icp: Icp): EngineIcp {
  const w = icp.scoring.weights;
  const range = icp.employee_range;
  return {
    industries: icp.industries.map((value) => ({ value, weight: w.industry })),
    employee_range: range && (range.min !== null || range.max !== null) ? { min: range.min, max: range.max, weight: w.employee_range } : null,
    geographies: icp.geographies.map((value) => ({ value, weight: w.geography })),
    titles: icp.titles.length > 0 ? [{ keywords: icp.titles, weight: w.title }] : [],
    keyword_signals: icp.scoring.keywords.map((k) => ({ keyword: k.keyword, weight: k.weight })),
    exclusions: { industries: icp.exclusions.industries, domains: icp.exclusions.domains, titles: icp.exclusions.titles },
    min_score_to_qualify: icp.scoring.min_score_to_qualify,
  };
}

/** Stable fingerprint of what affects scoring — used to make "re-score after an ICP edit" jobs idempotent. */
export async function icpFingerprint(icp: Icp): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(toEngineIcp(icp)));
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) => b.toString(16).padStart(2, "0")).join("");
}
