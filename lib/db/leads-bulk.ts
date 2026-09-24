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
 * Deletes leads that have no send history. A lead that was ever emailed cannot
 * be deleted — its campaign_sends rows are the record cooldown/DNC audits rely
 * on (Do Not Contact is the right tool there).
 */
export async function deleteLeadsWithoutHistory(
  workspaceId: number,
  leadIds: number[],
): Promise<{ deleted: number[]; blocked: number[] }> {
  const rows = await sql.query(
    `delete from leads l
     where l.workspace_id = $1 and l.id = any($2::bigint[])
       and not exists (select 1 from campaign_sends cs where cs.lead_id = l.id)
     returning l.id`,
    [workspaceId, leadIds],
  );
  const deleted = rows.map((r) => Number(r.id));
  const owned = await sql.query(`select id from leads where workspace_id = $1 and id = any($2::bigint[])`, [workspaceId, leadIds]);
  return { deleted, blocked: owned.map((r) => Number(r.id)) };
}
