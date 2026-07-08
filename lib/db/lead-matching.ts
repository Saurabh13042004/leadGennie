import { sql } from "@/lib/db/client";

export type FilterCriteria = {
  regions: string[];
  industries: string[];
  titles: string[];
  fundingStage: string | null;
  minEmployees: number | null;
  maxEmployees: number | null;
  minRevenueM: number | null;
};

export const REGION_KEYWORDS: Record<string, string[]> = {
  India: ["india", "indian"],
  "United States": ["us", "united states", "america", "u.s."],
  EMEA: ["emea", "europe", "uk", "united kingdom"],
  APAC: ["apac", "asia"],
};

export const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Tech / Software": ["tech", "software", "saas"],
  Fintech: ["fintech", "financial"],
  "E-commerce": ["e-commerce", "ecommerce", "retail"],
};

export const TITLE_KEYWORDS = [
  "vp of engineering",
  "vp engineering",
  "cto",
  "chief technology officer",
  "founder",
  "co-founder",
  "ceo",
  "decision maker",
  "head of sales",
  "vp of sales",
];

export function extractCriteriaRegex(prompt: string): FilterCriteria {
  const lower = prompt.toLowerCase();

  const regions = Object.entries(REGION_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => lower.includes(k)))
    .map(([label]) => label);

  const industries = Object.entries(INDUSTRY_KEYWORDS)
    .filter(([, keywords]) => keywords.some((k) => lower.includes(k)))
    .map(([label]) => label);

  const titles = TITLE_KEYWORDS.filter((t) => lower.includes(t));

  const fundingMatch = lower.match(/series\s*([a-e])/);
  const fundingStage = fundingMatch ? `Series ${fundingMatch[1].toUpperCase()}` : lower.includes("seed") ? "Seed" : null;

  const employeeRangeMatch = lower.match(/(\d+)\s*-\s*(\d+)\s*employees/);
  const employeeMinMatch = lower.match(/more than\s*(\d+)|(\d+)\s*\+\s*employees|over\s*(\d+)\s*employees/);

  let minEmployees: number | null = null;
  let maxEmployees: number | null = null;
  if (employeeRangeMatch) {
    minEmployees = Number(employeeRangeMatch[1]);
    maxEmployees = Number(employeeRangeMatch[2]);
  } else if (employeeMinMatch) {
    minEmployees = Number(employeeMinMatch[1] || employeeMinMatch[2] || employeeMinMatch[3]);
  }

  const revenueMatch = lower.match(/\$?(\d+)\s*m\b/);
  const minRevenueM = revenueMatch ? Number(revenueMatch[1]) : null;

  return {
    regions,
    industries,
    titles,
    fundingStage,
    minEmployees,
    maxEmployees,
    minRevenueM,
  };
}

export function hashToRange(input: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min));
}

function patterns(criteria: FilterCriteria) {
  const titlePatterns = criteria.titles.map((t) => `%${t}%`);
  const companyPatterns = [...criteria.industries, ...criteria.regions].map((c) => `%${c}%`);
  return { titlePatterns, companyPatterns };
}

export function hasStructuredCriteria(criteria: FilterCriteria) {
  return criteria.titles.length > 0 || criteria.industries.length > 0 || criteria.regions.length > 0;
}

export async function countMatchingLeads(owner: string, criteria: FilterCriteria): Promise<number> {
  const { titlePatterns, companyPatterns } = patterns(criteria);
  if (titlePatterns.length === 0 && companyPatterns.length === 0) return 0;

  const rows = await sql.query(
    `select count(*)::int as count
     from leads
     where owner_email = $1
       and (job_title ilike any($2::text[]) or company ilike any($3::text[]))`,
    [owner, titlePatterns, companyPatterns]
  );
  return (rows[0]?.count as number) ?? 0;
}

export type MatchedLead = {
  id: number;
  full_name: string;
  email: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
};

export async function fetchMatchingLeads(
  owner: string,
  criteria: FilterCriteria,
  limit: number
): Promise<MatchedLead[]> {
  const { titlePatterns, companyPatterns } = patterns(criteria);
  if (titlePatterns.length === 0 && companyPatterns.length === 0) return [];

  const rows = await sql.query(
    `select id, full_name, email, company, job_title, linkedin_url
     from leads
     where owner_email = $1
       and (job_title ilike any($2::text[]) or company ilike any($3::text[]))
     limit $4`,
    [owner, titlePatterns, companyPatterns, limit]
  );
  return rows as MatchedLead[];
}

export async function fetchAllLeads(owner: string, limit: number): Promise<MatchedLead[]> {
  const rows = await sql`
    select id, full_name, email, company, job_title, linkedin_url
    from leads
    where owner_email = ${owner}
    order by created_at desc
    limit ${limit}
  `;
  return rows as MatchedLead[];
}
