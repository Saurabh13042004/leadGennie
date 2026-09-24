import { sql } from "@/lib/db/client";
import type { ExistingCompany, PlannedCompany } from "@/lib/domain/companies/matcher";

/**
 * Company queries. Every function takes workspaceId first and filters by it —
 * a company is never visible, matchable or mutable across workspaces.
 */

export type CompanyRow = {
  id: number;
  name: string;
  domain: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  location: string | null;
  description: string | null;
  source: string;
  created_at: string;
};

export type CompanySummary = { id: number; name: string; domain: string | null; lead_count: number };

function toExisting(r: Record<string, unknown>): ExistingCompany {
  return { id: Number(r.id), name: r.name as string, nameKey: r.name_key as string, domain: (r.domain as string | null) ?? null };
}

/** Candidates that could match any of the given domains or name keys (one workspace). */
export async function findCompanyCandidates(
  workspaceId: number,
  domains: string[],
  nameKeys: string[],
): Promise<ExistingCompany[]> {
  if (domains.length === 0 && nameKeys.length === 0) return [];
  const rows = await sql.query(
    `select id, name, name_key, lower(domain) as domain
     from companies
     where workspace_id = $1 and (lower(domain) = any($2::text[]) or name_key = any($3::text[]))`,
    [workspaceId, domains, nameKeys],
  );
  return rows.map(toExisting);
}

/** Insert-if-absent. Concurrent imports racing on the same company converge via the unique indexes. */
export async function insertCompanies(workspaceId: number, companies: PlannedCompany[], source: string): Promise<void> {
  if (companies.length === 0) return;
  await sql.query(
    `insert into companies (workspace_id, name, name_key, domain, source)
     select $1, t.name, t.name_key, t.domain, $5
     from unnest($2::text[], $3::text[], $4::text[]) as t(name, name_key, domain)
     on conflict do nothing`,
    [workspaceId, companies.map((c) => c.name), companies.map((c) => c.nameKey), companies.map((c) => c.domain), source],
  );
}

/** A name-only company learns its domain. Skipped (not failed) if that domain now belongs to another company. */
export async function adoptDomains(workspaceId: number, adoptions: { id: number; domain: string }[]): Promise<void> {
  if (adoptions.length === 0) return;
  await sql.query(
    `update companies c set domain = a.domain, updated_at = now()
     from unnest($2::bigint[], $3::text[]) as a(id, domain)
     where c.workspace_id = $1 and c.id = a.id and c.domain is null
       and not exists (select 1 from companies o where o.workspace_id = $1 and lower(o.domain) = a.domain)`,
    [workspaceId, adoptions.map((a) => a.id), adoptions.map((a) => a.domain)],
  );
}

/** Autocomplete for the lead form: prefix/substring on the name, most-used first. */
export async function searchCompanies(workspaceId: number, query: string, limit: number): Promise<CompanySummary[]> {
  const q = query.trim().toLowerCase();
  const rows = await sql.query(
    `select c.id, c.name, c.domain, count(l.id)::int as lead_count
     from companies c
     left join leads l on l.company_id = c.id and l.workspace_id = c.workspace_id
     where c.workspace_id = $1
       and ($2 = '' or lower(c.name) like $3 or lower(coalesce(c.domain, '')) like $3)
     group by c.id
     order by (lower(c.name) like $4) desc, count(l.id) desc, c.name asc
     limit $5`,
    [workspaceId, q, `%${q.replace(/[%_\\]/g, "\\$&")}%`, `${q.replace(/[%_\\]/g, "\\$&")}%`, limit],
  );
  return rows.map((r) => ({ id: Number(r.id), name: r.name as string, domain: (r.domain as string | null) ?? null, lead_count: Number(r.lead_count) }));
}

export async function getCompany(workspaceId: number, id: number): Promise<CompanyRow | null> {
  const rows = await sql`
    select id, name, domain, linkedin_url, industry, employee_count, location, description, source, created_at
    from companies where id = ${id} and workspace_id = ${workspaceId}
  `;
  return (rows[0] as CompanyRow | undefined) ?? null;
}
