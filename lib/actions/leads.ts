"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";

export type Lead = {
  id: number;
  full_name: string;
  email: string | null;
  company: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  stage: string;
  source: string;
  created_at: string;
};

async function requireOwnerEmail() {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not authenticated");
  return email;
}

export async function listLeads(): Promise<Lead[]> {
  const owner = await requireOwnerEmail();
  const rows = await sql`
    select id, full_name, email, company, job_title, linkedin_url, stage, source, created_at
    from leads
    where owner_email = ${owner}
    order by created_at desc
    limit 500
  `;
  return rows as Lead[];
}

export type ImportRow = {
  full_name: string;
  email?: string;
  company?: string;
  job_title?: string;
  linkedin_url?: string;
};

export async function importLeadsCsv(rows: ImportRow[]) {
  const owner = await requireOwnerEmail();
  const cleanRows = rows.filter((r) => r.full_name?.trim());

  if (cleanRows.length === 0) {
    return { imported: 0 };
  }

  const ownerEmails = cleanRows.map(() => owner);
  const fullNames = cleanRows.map((r) => r.full_name.trim());
  const emails = cleanRows.map((r) => r.email?.trim() || null);
  const companies = cleanRows.map((r) => r.company?.trim() || null);
  const jobTitles = cleanRows.map((r) => r.job_title?.trim() || null);
  const linkedinUrls = cleanRows.map((r) => r.linkedin_url?.trim() || null);
  const sources = cleanRows.map(() => "csv");

  await sql.query(
    `insert into leads (owner_email, full_name, email, company, job_title, linkedin_url, source)
     select * from unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[])`,
    [ownerEmails, fullNames, emails, companies, jobTitles, linkedinUrls, sources]
  );

  revalidatePath("/dashboard/leads");
  return { imported: cleanRows.length };
}

export type FilterCriteria = {
  regions: string[];
  industries: string[];
  titles: string[];
  fundingStage: string | null;
  minEmployees: number | null;
  maxEmployees: number | null;
  minRevenueM: number | null;
};

export type AiFilterResult = {
  id: number;
  name: string;
  criteria: FilterCriteria;
  estimatedCount: number;
};

const REGION_KEYWORDS: Record<string, string[]> = {
  India: ["india", "indian"],
  "United States": ["us", "united states", "america", "u.s."],
  EMEA: ["emea", "europe", "uk", "united kingdom"],
  APAC: ["apac", "asia"],
};

const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  "Tech / Software": ["tech", "software", "saas"],
  Fintech: ["fintech", "financial"],
  "E-commerce": ["e-commerce", "ecommerce", "retail"],
};

const TITLE_KEYWORDS = [
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

function extractCriteria(prompt: string): FilterCriteria {
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

function hashToRange(input: string, min: number, max: number) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return min + (hash % (max - min));
}

export async function generateAiFilter(prompt: string): Promise<AiFilterResult> {
  const owner = await requireOwnerEmail();
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is required");

  const criteria = extractCriteria(trimmed);

  const titleConditions = criteria.titles;
  const companyConditions = [...criteria.industries, ...criteria.regions];

  let matchedCount = 0;
  if (titleConditions.length || companyConditions.length) {
    const titlePatterns = titleConditions.map((t) => `%${t}%`);
    const companyPatterns = companyConditions.map((c) => `%${c}%`);
    const rows = await sql.query(
      `select count(*)::int as count
       from leads
       where owner_email = $1
         and (job_title ilike any($2::text[]) or company ilike any($3::text[]))`,
      [owner, titlePatterns, companyPatterns]
    );
    matchedCount = (rows[0]?.count as number) ?? 0;
  }

  const estimatedCount = matchedCount > 0 ? matchedCount : hashToRange(trimmed, 150, 2200);

  const name = trimmed.length > 60 ? `${trimmed.slice(0, 57)}...` : trimmed;

  const inserted = await sql`
    insert into segments (owner_email, name, prompt, criteria, lead_count)
    values (${owner}, ${name}, ${trimmed}, ${JSON.stringify(criteria)}, ${estimatedCount})
    returning id
  `;

  revalidatePath("/dashboard/leads");

  return {
    id: inserted[0].id as number,
    name,
    criteria,
    estimatedCount,
  };
}
