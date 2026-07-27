import { sql } from "@/lib/db/client";
import { createApprovalRequest } from "@/lib/approvals-core";
import { logActivity } from "@/lib/activity";

/**
 * Shared by both the authenticated review actions (lib/actions/forms.ts) and
 * the public, unauthenticated form-submit endpoint — the latter has no
 * session to gate with requireRole, so this core logic lives outside any
 * "use server" action file and takes an explicit, already-resolved
 * workspaceId instead of deriving one from a request.
 */
export async function proposeLeadFromSubmission(input: {
  workspaceId: number;
  submissionId: number;
  action: "create" | "update";
  fields: Record<string, string>;
  leadId?: number;
  ownerEmail?: string;
  requestedByUserId: number | null;
}): Promise<number> {
  const title =
    input.action === "create"
      ? `New lead from form: ${input.fields.full_name || input.fields.email || "Unknown"}`
      : `Update lead from form submission`;
  const summary =
    input.action === "create"
      ? `Create lead — ${input.fields.email ?? "no email"}${input.fields.company ? ` at ${input.fields.company}` : ""}`
      : `Apply submitted fields to existing lead`;

  const approvalId = await createApprovalRequest({
    workspaceId: input.workspaceId,
    type: "form_lead_proposal",
    entityType: "form_submission",
    entityId: input.submissionId,
    title,
    summary,
    payload: {
      action: input.action,
      submissionId: input.submissionId,
      leadId: input.leadId,
      fields: input.fields,
      owner: input.ownerEmail,
    },
    requestedByUserId: input.requestedByUserId,
  });

  await sql`
    update form_submissions
    set approval_id = ${approvalId}, status = 'proposed', matched_lead_id = coalesce(${input.leadId ?? null}, matched_lead_id)
    where id = ${input.submissionId}
  `;

  await logActivity({
    workspaceId: input.workspaceId,
    actorUserId: input.requestedByUserId,
    type: "form_submission.proposed",
    entityType: "form_submission",
    entityId: input.submissionId,
    summary: title,
  });

  return approvalId;
}

export type PublicForm = {
  id: number;
  name: string;
  fields: { key: string; label: string; type: "text" | "email" | "tel"; required: boolean }[];
  consentText: string;
};

/** Public lookup for the hosted form page and embed — no auth, embed_key is the bearer credential. */
export async function getPublicForm(embedKey: string): Promise<PublicForm | null> {
  const rows = await sql`
    select id, name, fields, consent_text from forms where embed_key = ${embedKey} and status = 'active'
  `;
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id as number,
    name: row.name as string,
    fields: row.fields as PublicForm["fields"],
    consentText: row.consent_text as string,
  };
}

export async function workspaceOwnerEmail(workspaceId: number): Promise<string> {
  const rows = await sql`
    select u.email from workspace_members wm
    join users u on u.id = wm.user_id
    where wm.workspace_id = ${workspaceId} and wm.role = 'owner' and wm.status = 'active'
    order by wm.created_at asc
    limit 1
  `;
  return (rows[0]?.email as string) ?? "unknown@workspace";
}
