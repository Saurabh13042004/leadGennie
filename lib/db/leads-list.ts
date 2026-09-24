import { sql } from "@/lib/db/client";
import { LEAD_PAGE_SIZE, type LeadListQuery, type LeadSortKey } from "@/lib/domain/leads/list-query";

/**
 * The paginated, filterable lead list. Everything is filtered by workspace_id
 * first; user-controlled values only ever travel as bound parameters, and the
 * ORDER BY comes from a fixed allow-list.
 */

export type LeadListRow = {
  id: number;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_status: string;
  company: string | null;
  company_id: number | null;
  company_name: string | null;
  company_domain: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  stage: string;
  source: string;
  created_at: string;
  // Phase 2B: research + score (all null/none until a lead has been researched)
  icp_score: number | null;
  intent_score: number | null;
  qualified: boolean | null;
  research_status: string;
  researched_at: string | null;
  /** Distinct types of the lead's current VERIFIED signals (e.g. HIRING, FUNDING). */
  signal_types: string[];
  /** On the workspace's Do Not Contact list — derived live, so it can never go stale. */
  blocked: boolean;
};

export type Facet = { value: string; count: number };

export type LeadListPage = {
  rows: LeadListRow[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
  facets: { stages: Facet[]; sources: Facet[] };
};

const SORT_SQL: Record<LeadSortKey, string> = {
  created: "l.created_at",
  name: "lower(l.full_name)",
  company: "lower(coalesce(c.name, l.company, ''))",
  stage: "l.stage",
  email_status: "l.email_status",
  icp: "l.icp_score",
};

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

function buildWhere(workspaceId: number, q: LeadListQuery) {
  const params: unknown[] = [workspaceId];
  const clauses = ["l.workspace_id = $1"];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (q.search) {
    const p = bind(`%${escapeLike(q.search.toLowerCase())}%`);
    clauses.push(`(lower(l.full_name) like ${p} or lower(coalesce(l.email, '')) like ${p}
      or lower(coalesce(c.name, l.company, '')) like ${p} or lower(coalesce(l.job_title, '')) like ${p})`);
  }
  if (q.stage) clauses.push(`l.stage = ${bind(q.stage)}`);
  if (q.source) clauses.push(`l.source = ${bind(q.source)}`);
  if (q.emailStatus === "none") clauses.push("l.email is null");
  else if (q.emailStatus) clauses.push(`l.email is not null and l.email_status = ${bind(q.emailStatus)}`);
  if (q.companyId) clauses.push(`l.company_id = ${bind(q.companyId)}`);
  if (q.research === "researched") clauses.push("l.research_status in ('done', 'partial')");
  else if (q.research) clauses.push(`l.research_status = ${bind(q.research)}`);
  if (q.minScore > 0) clauses.push(`l.icp_score >= ${bind(q.minScore)}`);
  return { where: clauses.join(" and "), params };
}

const FROM = `from leads l left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id`;

export async function listLeadsPage(workspaceId: number, q: LeadListQuery): Promise<LeadListPage> {
  const { where, params } = buildWhere(workspaceId, q);

  const [countRows, stageRows, sourceRows] = await Promise.all([
    sql.query(`select count(*)::int as n ${FROM} where ${where}`, params),
    sql.query(`select stage as value, count(*)::int as count from leads where workspace_id = $1 group by stage order by count desc, stage`, [workspaceId]),
    sql.query(`select source as value, count(*)::int as count from leads where workspace_id = $1 group by source order by count desc, source`, [workspaceId]),
  ]);
  const total = Number(countRows[0].n);
  const pageCount = Math.max(1, Math.ceil(total / LEAD_PAGE_SIZE));
  const page = Math.min(q.page, pageCount);

  const dir = q.dir === "asc" ? "asc" : "desc";
  const rows = await sql.query(
    `select l.id, l.full_name, l.first_name, l.last_name, l.email, l.email_status, l.company, l.company_id,
            c.name as company_name, c.domain as company_domain, l.job_title, l.linkedin_url, l.phone,
            l.stage, l.source, l.created_at,
            l.icp_score, l.intent_score, l.qualified, l.research_status, l.researched_at,
            coalesce((select json_agg(t.type order by t.type) from (
               select distinct s.type from signals s
               where s.lead_id = l.id and s.workspace_id = l.workspace_id and s.is_current and s.verified) t), '[]'::json) as signal_types,
            (l.email is not null and exists (
               select 1 from do_not_contact d where d.workspace_id = l.workspace_id and lower(d.email) = lower(l.email)
            )) as blocked
     ${FROM}
     where ${where}
     order by ${SORT_SQL[q.sort]} ${dir}${q.sort === "icp" ? " nulls last" : ""}, l.id ${dir}
     limit ${LEAD_PAGE_SIZE} offset ${(page - 1) * LEAD_PAGE_SIZE}`,
    params,
  );

  const facet = (r: Record<string, unknown>): Facet => ({ value: r.value as string, count: Number(r.count) });
  return {
    rows: rows.map((r) => ({
      ...(r as unknown as LeadListRow),
      id: Number(r.id),
      company_id: r.company_id === null ? null : Number(r.company_id),
    })),
    total,
    page,
    pageCount,
    pageSize: LEAD_PAGE_SIZE,
    facets: { stages: stageRows.map(facet), sources: sourceRows.map(facet) },
  };
}

export type LeadDetail = LeadListRow & { source_url: string | null };

export async function getLeadDetail(workspaceId: number, id: number): Promise<LeadDetail | null> {
  const rows = await sql.query(
    `select l.id, l.full_name, l.first_name, l.last_name, l.email, l.email_status, l.company, l.company_id,
            c.name as company_name, c.domain as company_domain, l.job_title, l.linkedin_url, l.phone,
            l.stage, l.source, l.source_url, l.created_at,
            l.icp_score, l.intent_score, l.qualified, l.research_status, l.researched_at, '[]'::json as signal_types,
            (l.email is not null and exists (
               select 1 from do_not_contact d where d.workspace_id = l.workspace_id and lower(d.email) = lower(l.email)
            )) as blocked
     ${FROM} where l.workspace_id = $1 and l.id = $2`,
    [workspaceId, id],
  );
  const r = rows[0];
  return r ? ({ ...(r as unknown as LeadDetail), id: Number(r.id), company_id: r.company_id === null ? null : Number(r.company_id) }) : null;
}
