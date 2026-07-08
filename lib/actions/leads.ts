"use server";

import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { extractCriteriaWithAi } from "@/lib/ai/filter";
import { GeminiError } from "@/lib/ai/gemini";
import {
  countMatchingLeads,
  extractCriteriaRegex,
  hashToRange,
  hasStructuredCriteria,
  type FilterCriteria,
} from "@/lib/db/lead-matching";

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

export type AiFilterResult = {
  id: number;
  name: string;
  criteria: FilterCriteria;
  estimatedCount: number;
};

export async function generateAiFilter(prompt: string): Promise<AiFilterResult> {
  const owner = await requireOwnerEmail();
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("Prompt is required");

  let criteria: FilterCriteria;
  try {
    criteria = await extractCriteriaWithAi(trimmed);
  } catch (error) {
    if (!(error instanceof GeminiError)) throw error;
    criteria = extractCriteriaRegex(trimmed);
  }

  const matchedCount = await countMatchingLeads(owner, criteria);
  const estimatedCount =
    matchedCount > 0
      ? matchedCount
      : hasStructuredCriteria(criteria)
        ? 0
        : hashToRange(trimmed, 150, 2200);

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
