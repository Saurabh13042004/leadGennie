"use server";

import { randomBytes } from "node:crypto";
import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { proposeLeadFromSubmission, workspaceOwnerEmail } from "@/lib/forms-core";

export type FormField = { key: string; label: string; type: "text" | "email" | "tel"; required: boolean };

export type FormDefinition = {
  id: number;
  name: string;
  embedKey: string;
  fields: FormField[];
  consentText: string;
  consentVersion: string;
  status: "active" | "paused";
  submissionCount: number;
  createdAt: string;
};

const DEFAULT_FIELDS: FormField[] = [
  { key: "full_name", label: "Full name", type: "text", required: true },
  { key: "email", label: "Work email", type: "email", required: true },
  { key: "company", label: "Company", type: "text", required: false },
];

export async function listForms(): Promise<FormDefinition[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select f.id, f.name, f.embed_key, f.fields, f.consent_text, f.consent_version, f.status, f.created_at,
      (select count(*)::int from form_submissions fs where fs.form_id = f.id) as submission_count
    from forms f
    where f.workspace_id = ${workspaceId}
    order by f.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    embedKey: r.embed_key as string,
    fields: r.fields as FormField[],
    consentText: r.consent_text as string,
    consentVersion: r.consent_version as string,
    status: r.status as "active" | "paused",
    submissionCount: r.submission_count as number,
    createdAt: r.created_at as string,
  }));
}

export async function createForm(input: { name: string; consentText: string; fields?: FormField[] }) {
  const { workspaceId, userId } = await requireRole("member");
  if (!input.name.trim()) throw new Error("Form needs a name");
  if (!input.consentText.trim()) throw new Error("Consent text is required (FORM-01).");

  const embedKey = randomBytes(12).toString("base64url");

  const inserted = await sql`
    insert into forms (workspace_id, name, embed_key, fields, consent_text, consent_version, created_by_user_id)
    values (
      ${workspaceId}, ${input.name.trim()}, ${embedKey}, ${JSON.stringify(input.fields ?? DEFAULT_FIELDS)},
      ${input.consentText.trim()}, '1', ${userId}
    )
    returning id
  `;
  const formId = inserted[0].id as number;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form.created",
    entityType: "form",
    entityId: formId,
    summary: `Created form "${input.name.trim()}"`,
  });

  revalidatePath("/dashboard/inbox");
  return { id: formId, embedKey };
}

export async function toggleFormStatus(id: number, status: "active" | "paused") {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    update forms set status = ${status} where id = ${id} and workspace_id = ${workspaceId} returning name
  `;
  if (rows.length === 0) throw new Error("Form not found");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form.status_changed",
    entityType: "form",
    entityId: id,
    summary: `${status === "active" ? "Resumed" : "Paused"} form "${rows[0].name}"`,
  });
  revalidatePath("/dashboard/inbox");
}

export type Submission = {
  id: number;
  formName: string;
  payload: Record<string, string>;
  consentGiven: boolean;
  consentVersion: string | null;
  pageUrl: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  status: string;
  matchedLeadId: number | null;
  matchedLeadName: string | null;
  approvalId: number | null;
  ownerName: string | null;
  createdAt: string;
};

export async function listSubmissions(status?: string): Promise<Submission[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = status
    ? await sql`
        select fs.*, f.name as form_name, l.full_name as matched_lead_name, u.name as owner_name
        from form_submissions fs
        join forms f on f.id = fs.form_id
        left join leads l on l.id = fs.matched_lead_id
        left join users u on u.id = fs.owner_user_id
        where fs.workspace_id = ${workspaceId} and fs.status = ${status}
        order by fs.created_at desc
        limit 200
      `
    : await sql`
        select fs.*, f.name as form_name, l.full_name as matched_lead_name, u.name as owner_name
        from form_submissions fs
        join forms f on f.id = fs.form_id
        left join leads l on l.id = fs.matched_lead_id
        left join users u on u.id = fs.owner_user_id
        where fs.workspace_id = ${workspaceId}
        order by fs.created_at desc
        limit 200
      `;

  return rows.map((r) => ({
    id: r.id as number,
    formName: r.form_name as string,
    payload: r.payload as Record<string, string>,
    consentGiven: r.consent_given as boolean,
    consentVersion: r.consent_version as string | null,
    pageUrl: r.page_url as string | null,
    utmSource: r.utm_source as string | null,
    utmCampaign: r.utm_campaign as string | null,
    status: r.status as string,
    matchedLeadId: r.matched_lead_id as number | null,
    matchedLeadName: r.matched_lead_name as string | null,
    approvalId: r.approval_id as number | null,
    ownerName: r.owner_name as string | null,
    createdAt: r.created_at as string,
  }));
}

/** INB-04: explicitly create a lead from a submission that doesn't already have a pending proposal. */
export async function createLeadFromSubmission(submissionId: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    select payload, approval_id from form_submissions where id = ${submissionId} and workspace_id = ${workspaceId}
  `;
  const submission = rows[0];
  if (!submission) throw new Error("Submission not found");
  if (submission.approval_id) throw new Error("This submission already has a proposal pending review.");

  const owner = await workspaceOwnerEmail(workspaceId);
  const approvalId = await proposeLeadFromSubmission({
    workspaceId,
    submissionId,
    action: "create",
    fields: submission.payload as Record<string, string>,
    ownerEmail: owner,
    requestedByUserId: userId,
  });

  revalidatePath("/dashboard/inbox");
  return { approvalId };
}

/** Manually link a submission to an existing lead — proposes updating that lead's fields. */
export async function linkSubmissionToLead(submissionId: number, leadId: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    select payload, approval_id from form_submissions where id = ${submissionId} and workspace_id = ${workspaceId}
  `;
  const submission = rows[0];
  if (!submission) throw new Error("Submission not found");
  if (submission.approval_id) throw new Error("This submission already has a proposal pending review.");

  const leadRows = await sql`select full_name from leads where id = ${leadId} and workspace_id = ${workspaceId}`;
  if (leadRows.length === 0) throw new Error("Lead not found in this workspace.");

  const approvalId = await proposeLeadFromSubmission({
    workspaceId,
    submissionId,
    action: "update",
    fields: submission.payload as Record<string, string>,
    leadId,
    requestedByUserId: userId,
  });

  revalidatePath("/dashboard/inbox");
  return { approvalId };
}

export async function markSubmissionSpam(id: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    update form_submissions set status = 'spam' where id = ${id} and workspace_id = ${workspaceId} returning id
  `;
  if (rows.length === 0) throw new Error("Submission not found");
  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form_submission.marked_spam",
    entityType: "form_submission",
    entityId: id,
    summary: "Marked form submission as spam",
  });
  revalidatePath("/dashboard/inbox");
}

export async function applyDncFromSubmission(id: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    select payload from form_submissions where id = ${id} and workspace_id = ${workspaceId}
  `;
  const submission = rows[0];
  if (!submission) throw new Error("Submission not found");
  const email = (submission.payload as Record<string, string>).email;
  if (!email) throw new Error("Submission has no email to suppress");

  await sql`
    insert into do_not_contact (workspace_id, email, reason, source, created_by_user_id)
    values (${workspaceId}, ${email.toLowerCase()}, 'Requested via form submission review', 'form_review', ${userId})
    on conflict (workspace_id, lower(email)) do nothing
  `;
  await sql`update form_submissions set status = 'resolved' where id = ${id}`;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form_submission.dnc_applied",
    entityType: "form_submission",
    entityId: id,
    summary: `Added ${email} to Do Not Contact from form review`,
  });
  revalidatePath("/dashboard/inbox");
}

export async function assignSubmission(id: number, ownerUserId: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    update form_submissions set owner_user_id = ${ownerUserId}
    where id = ${id} and workspace_id = ${workspaceId}
    returning id
  `;
  if (rows.length === 0) throw new Error("Submission not found");
  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form_submission.assigned",
    entityType: "form_submission",
    entityId: id,
    summary: "Assigned form submission for follow-up",
  });
  revalidatePath("/dashboard/inbox");
}

export async function ignoreSubmission(id: number) {
  const { workspaceId, userId } = await requireRole("member");
  const rows = await sql`
    update form_submissions set status = 'ignored' where id = ${id} and workspace_id = ${workspaceId} returning id
  `;
  if (rows.length === 0) throw new Error("Submission not found");
  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "form_submission.ignored",
    entityType: "form_submission",
    entityId: id,
    summary: "Ignored form submission",
  });
  revalidatePath("/dashboard/inbox");
}
