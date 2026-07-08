import { generateJson, Type } from "@/lib/ai/gemini";
import type { FilterCriteria } from "@/lib/db/lead-matching";

const FILTER_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    regions: { type: Type.ARRAY, items: { type: Type.STRING } },
    industries: { type: Type.ARRAY, items: { type: Type.STRING } },
    titles: { type: Type.ARRAY, items: { type: Type.STRING } },
    fundingStage: { type: Type.STRING, nullable: true },
    minEmployees: { type: Type.INTEGER, nullable: true },
    maxEmployees: { type: Type.INTEGER, nullable: true },
    minRevenueM: { type: Type.INTEGER, nullable: true },
  },
  required: ["regions", "industries", "titles"],
};

export async function extractCriteriaWithAi(prompt: string): Promise<FilterCriteria> {
  const result = await generateJson<Partial<FilterCriteria>>(
    `You extract structured ideal-customer-profile (ICP) filters from a sales rep's plain-English description of who they want to target.

Description: "${prompt}"

Return JSON matching this shape:
- regions: array of short region/country names mentioned (e.g. "India", "United States", "EMEA", "APAC"). Empty array if none.
- industries: array of short industry names mentioned (e.g. "Tech / Software", "Fintech", "E-commerce"). Empty array if none.
- titles: array of job titles or seniority levels mentioned, lowercase (e.g. "cto", "vp of engineering", "founder"). Empty array if none.
- fundingStage: funding stage if mentioned (e.g. "Series A", "Seed"), else null.
- minEmployees / maxEmployees: employee count bounds if mentioned, else null.
- minRevenueM: minimum revenue in millions USD if mentioned, else null.

Only include values actually implied by the description. Do not invent data.`,
    FILTER_SCHEMA
  );

  return {
    regions: result.regions ?? [],
    industries: result.industries ?? [],
    titles: (result.titles ?? []).map((t) => t.toLowerCase()),
    fundingStage: result.fundingStage ?? null,
    minEmployees: result.minEmployees ?? null,
    maxEmployees: result.maxEmployees ?? null,
    minRevenueM: result.minRevenueM ?? null,
  };
}
