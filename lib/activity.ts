import { sql } from "@/lib/db/client";

/**
 * Append-only audit entry (TASK-02 and general audit). Never update or
 * delete a row written here — if something needs correcting, log a new
 * entry that supersedes it instead.
 */
export async function logActivity(input: {
  workspaceId: number;
  actorUserId: number | null;
  type: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  await sql`
    insert into activities (workspace_id, actor_user_id, type, entity_type, entity_id, summary, metadata)
    values (
      ${input.workspaceId}, ${input.actorUserId}, ${input.type}, ${input.entityType}, ${input.entityId},
      ${input.summary}, ${JSON.stringify(input.metadata ?? {})}
    )
  `;
}
