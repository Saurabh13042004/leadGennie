import { sql } from "@/lib/db/client";
import { normalizeCompanyName } from "@/lib/domain/companies/normalize";
import { linkedinSlug } from "@/lib/domain/leads/urls";
import { normalizeEmail } from "@/lib/domain/leads/email";

/** Read queries the extension uses to stay in sync with the app. Every one filters by workspace_id first. */

export type LeadRef = {
  id: number;
  fullName: string;
  jobTitle: string | null;
  company: string | null;
  companyDomain: string | null;
  email: string | null;
  emailStatus: string;
  linkedinUrl: string | null;
  stage: string;
  researchStatus: string;
  icpScore: number | null;
  qualified: boolean | null;
  createdAt: string;
};

const COLS = `l.id, l.full_name, l.job_title, coalesce(c.name, l.company) as company, c.domain as company_domain,
  l.email, l.email_status, l.linkedin_url, l.stage, l.research_status, l.icp_score, l.qualified, l.created_at`;
const FROM = `from leads l left join companies c on c.id = l.company_id and c.workspace_id = l.workspace_id`;

function toRef(r: Record<string, unknown>): LeadRef {
  return {
    id: Number(r.id),
    fullName: r.full_name as string,
    jobTitle: (r.job_title as string | null) ?? null,
    company: (r.company as string | null) ?? null,
    companyDomain: (r.company_domain as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    emailStatus: r.email_status as string,
    linkedinUrl: (r.linkedin_url as string | null) ?? null,
    stage: r.stage as string,
    researchStatus: (r.research_status as string) ?? "none",
    icpScore: r.icp_score === null || r.icp_score === undefined ? null : Number(r.icp_score),
    qualified: r.qualified === null || r.qualified === undefined ? null : r.qualified === true,
    createdAt: String(r.created_at),
  };
}

const SLUG = `substring(lower(l.linkedin_url) from 'linkedin\\.com/(?:in|pub)/([^/?#]+)')`;

/**
 * Is this person already a lead? Same identity rules as the CSV import, strongest first:
 * email → LinkedIn profile → (name + company). A name alone never matches — two "John Smith"s are not one lead.
 */
export async function findLeadByIdentity(
  workspaceId: number,
  who: { email?: string | null; linkedinUrl?: string | null; fullName?: string | null; company?: string | null },
): Promise<LeadRef | null> {
  const email = normalizeEmail(who.email);
  const slug = linkedinSlug(who.linkedinUrl);
  const companyKey = normalizeCompanyName(who.company);
  const name = who.fullName?.trim().toLowerCase() || null;

  const rows = await sql.query(
    `select ${COLS}, (case when $2::text is not null and lower(l.email) = $2 then 1
                           when $3::text is not null and ${SLUG} = $3 then 2 else 3 end) as rank
     ${FROM}
     where l.workspace_id = $1
       and ( ($2::text is not null and lower(l.email) = $2)
          or ($3::text is not null and ${SLUG} = $3)
          or ($4::text is not null and $5::text is not null and lower(l.full_name) = $4
              and lower(regexp_replace(coalesce(c.name, l.company, ''), '[^[:alnum:]]+', ' ', 'g')) like $5 || '%') )
     order by rank, l.id
     limit 1`,
    [workspaceId, email, slug, name, companyKey || null],
  );
  return rows[0] ? toRef(rows[0]) : null;
}

export async function getLeadRef(workspaceId: number, id: number): Promise<LeadRef | null> {
  const rows = await sql.query(`select ${COLS} ${FROM} where l.workspace_id = $1 and l.id = $2`, [workspaceId, id]);
  return rows[0] ? toRef(rows[0]) : null;
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export async function listRecentLeads(workspaceId: number, opts: { limit: number; q?: string }): Promise<{ leads: LeadRef[]; total: number }> {
  const q = opts.q?.trim().toLowerCase().slice(0, 100) || null;
  const like = q ? `%${escapeLike(q)}%` : null;
  const where = `l.workspace_id = $1 and ($2::text is null or lower(l.full_name) like $2 or lower(coalesce(l.email, '')) like $2
                 or lower(coalesce(c.name, l.company, '')) like $2)`;
  const [rows, count] = await Promise.all([
    sql.query(`select ${COLS} ${FROM} where ${where} order by l.created_at desc, l.id desc limit $3`, [workspaceId, like, opts.limit]),
    sql.query(`select count(*)::int as n ${FROM} where ${where}`, [workspaceId, like]),
  ]);
  return { leads: rows.map(toRef), total: Number(count[0].n) };
}

export type EmailAtDomain = { fullName: string; firstName: string | null; lastName: string | null; email: string };

/**
 * Emails this workspace already has at a domain, with the person's name — the evidence for "how does this company format
 * its addresses". Excludes emails known to be invalid.
 */
export async function listEmailsAtDomain(workspaceId: number, domain: string, limit: number): Promise<EmailAtDomain[]> {
  const rows = await sql.query(
    `select full_name, first_name, last_name, email
     from leads
     where workspace_id = $1 and email is not null and email_status <> 'invalid'
       and lower(split_part(email, '@', 2)) = $2
     order by created_at desc limit $3`,
    [workspaceId, domain.toLowerCase(), limit],
  );
  return rows.map((r) => ({
    fullName: r.full_name as string,
    firstName: (r.first_name as string | null) ?? null,
    lastName: (r.last_name as string | null) ?? null,
    email: r.email as string,
  }));
}
