import type { FilterCriteria } from "@/lib/db/lead-matching";

/** Human-readable chips for an audience's structured criteria (shared by the AI builder result and the saved list). */
export function criteriaChips(c: FilterCriteria): string[] {
  return [
    ...(c.companies ?? []),
    ...(c.regions ?? []),
    ...(c.industries ?? []),
    ...(c.titles ?? []),
    c.fundingStage,
    c.minEmployees ? `${c.minEmployees}${c.maxEmployees ? `-${c.maxEmployees}` : "+"} employees` : null,
    c.minRevenueM ? `>$${c.minRevenueM}M revenue` : null,
  ].filter(Boolean) as string[];
}
