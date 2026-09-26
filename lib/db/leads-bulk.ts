import { sql } from "@/lib/db/client";

/** Bulk lead mutations. Every statement is scoped by workspace_id, so ids from another tenant are inert. */

/** Adds the selected leads' emails to Do Not Contact. Returns how many were newly added. */
export async function addLeadsToDnc(
  workspaceId: number,
  userId: number,
  leadIds: number[],
  reason: string | null,
): Promise<{ selected: number; withEmail: number; added: number }> {
  const [counts] = await sql.query(
    `select count(*)::int as selected, count(email)::int as with_email
     from leads where workspace_id = $1 and id = any($2::bigint[])`,
    [workspaceId, leadIds],
  );
  const added = await sql.query(
    `insert into do_not_contact (workspace_id, email, reason, source, created_by_user_id)
     select distinct on (lower(l.email)) l.workspace_id, lower(l.email), $3, 'bulk_leads', $4
     from leads l where l.workspace_id = $1 and l.id = any($2::bigint[]) and l.email is not null
     on conflict (workspace_id, lower(email)) do nothing
     returning id`,
    [workspaceId, leadIds, reason, userId],
  );
  return { selected: Number(counts.selected), withEmail: Number(counts.with_email), added: added.length };
}

/**
 * Deletes leads that were never emailed. A lead that was ever contacted cannot be deleted — its campaign_sends /
 * messages rows are the record cooldown/DNC audits rely on (Do Not Contact is the right tool there). Emails that were
 * only SCHEDULED (pending, canceled or blocked) are not history: they go with the lead.
 *
 * The campaigns the lead was enrolled in are kept truthful in the same statement: their stored "enrolled"/"excluded"
 * counters drop by the leads that just disappeared (enrollment rows and pending sends cascade with the lead).
 */
export async function deleteLeadsWithoutHistory(
  workspaceId: number,
  leadIds: number[],
): Promise<{ deleted: number[]; blocked: number[] }> {
  const rows = await sql.query(
    `with gone as (
       delete from leads l
       where l.workspace_id = $1 and l.id = any($2::bigint[])
         and not exists (select 1 from campaign_sends cs where cs.lead_id = l.id and cs.status not in ('pending', 'canceled', 'blocked'))
         and not exists (select 1 from messages m where m.lead_id = l.id)
       returning l.id
     ),
     lost as (
       select x.campaign_id, count(*) filter (where not x.excluded)::int as enrolled, count(*) filter (where x.excluded)::int as excluded
       from (
         select cl.campaign_id, cl.lead_id, (cl.status = 'blocked') as excluded
           from campaign_leads cl where cl.workspace_id = $1 and cl.lead_id in (select id from gone)
         union
         select cs.campaign_id, cs.lead_id, false
           from campaign_sends cs
          where cs.workspace_id = $1 and cs.lead_id in (select id from gone)
            and not exists (select 1 from campaign_leads c2 where c2.campaign_id = cs.campaign_id and c2.lead_id = cs.lead_id)
       ) x
       group by x.campaign_id
     ),
     counted as (
       update campaigns c
          set total_leads = greatest(c.total_leads - lost.enrolled, 0), blocked_count = greatest(c.blocked_count - lost.excluded, 0)
         from lost
        where c.id = lost.campaign_id and c.workspace_id = $1
       returning c.id
     )
     select id from gone`,
    [workspaceId, leadIds],
  );
  const deleted = rows.map((r) => Number(r.id));
  const owned = await sql.query(`select id from leads where workspace_id = $1 and id = any($2::bigint[])`, [workspaceId, leadIds]);
  return { deleted, blocked: owned.map((r) => Number(r.id)) };
}
