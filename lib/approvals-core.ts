import { sql } from "@/lib/db/client";

export type ApprovalType =
  | "campaign_launch"
  | "prompt_publish"
  | "mailbox_add"
  | "mailbox_limit_change"
  | "form_lead_proposal";
export type ApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Internal helper for creating an approval request from within another server
 * action (e.g. createCampaign). Not itself a server action — the caller is
 * responsible for its own auth/role check before calling this.
 *
 * `requestedByUserId` is nullable because not every approval is requested by
 * an authenticated member — a form submission proposes a CRM change on its
 * own (system-initiated), with no acting user to attribute it to.
 */
export async function createApprovalRequest(input: {
  workspaceId: number;
  type: ApprovalType;
  entityType: string;
  entityId: number;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  requestedByUserId: number | null;
}): Promise<number> {
  const rows = await sql`
    insert into approvals (workspace_id, type, entity_type, entity_id, title, summary, payload, requested_by_user_id)
    values (
      ${input.workspaceId}, ${input.type}, ${input.entityType}, ${input.entityId},
      ${input.title}, ${input.summary}, ${JSON.stringify(input.payload)}, ${input.requestedByUserId}
    )
    returning id
  `;
  return rows[0].id as number;
}
