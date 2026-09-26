import {
  countMatchingLeads,
  hasStructuredCriteria,
  matchKnownCompanies,
  normalize,
  type FilterCriteria,
} from "@/lib/db/lead-matching";

export type EstimateMethod = "measured" | "no_matches" | "unmeasurable";

export type MeasuredSegment = { criteria: FilterCriteria; leadCount: number; estimateMethod: EstimateMethod };

/**
 * A saved audience's size, measured NOW against the workspace's current leads. The `segments.lead_count` column is only
 * what was true when the audience was saved: deleting or importing leads afterwards makes it wrong, and anything that
 * shows an audience size (the Audience page, the campaign builder's picker) must show this instead.
 *
 * Also recognises a literal company name in the original prompt (see matchKnownCompanies), so audiences saved before
 * that fix stop showing a fabricated count.
 */
export async function measureSegment(workspaceId: number, prompt: string | null, storedCriteria: unknown): Promise<MeasuredSegment> {
  let criteria = normalize(storedCriteria as Partial<FilterCriteria> | null);
  if (prompt) {
    const known = await matchKnownCompanies(workspaceId, prompt);
    if (known.length > 0) criteria = { ...criteria, companies: Array.from(new Set([...(criteria.companies ?? []), ...known])) };
  }
  const leadCount = await countMatchingLeads(workspaceId, criteria);
  const estimateMethod: EstimateMethod = leadCount > 0 ? "measured" : hasStructuredCriteria(criteria) ? "no_matches" : "unmeasurable";
  return { criteria, leadCount, estimateMethod };
}
