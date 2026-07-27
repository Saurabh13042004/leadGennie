"use server";

import { sql } from "@/lib/db/client";
import { requireRole } from "@/lib/auth/workspace-context";

export type ActivityRow = {
  id: number;
  actorName: string | null;
  type: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  createdAt: string;
};

export async function listActivities(): Promise<ActivityRow[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select a.id, a.type, a.entity_type, a.entity_id, a.summary, a.created_at, u.name as actor_name
    from activities a
    left join users u on u.id = a.actor_user_id
    where a.workspace_id = ${workspaceId}
    order by a.created_at desc
    limit 200
  `;
  return rows.map((r) => ({
    id: r.id as number,
    actorName: r.actor_name as string | null,
    type: r.type as string,
    entityType: r.entity_type as string,
    entityId: r.entity_id as number | null,
    summary: r.summary as string,
    createdAt: r.created_at as string,
  }));
}
