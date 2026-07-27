import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { isOnDoNotContact } from "@/lib/compliance";
import { proposeLeadFromSubmission, workspaceOwnerEmail } from "@/lib/forms-core";

export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

type SubmitBody = {
  fields: Record<string, string>;
  consentGiven?: boolean;
  pageUrl?: string;
  utm?: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  _hp?: string; // honeypot — real visitors never fill this in
};

/**
 * INB-01/FORM-01: the raw submission is always stored first — exact payload,
 * consent text/version, IP, UTM — before any spam-check, dedupe, or CRM
 * proposal logic runs. INB-04: a matched/unmatched lead never gets created or
 * updated directly here — this only ever opens an approval request.
 */
export async function POST(request: Request, { params }: { params: Promise<{ embedKey: string }> }) {
  const { embedKey } = await params;

  const formRows = await sql`
    select id, workspace_id, status, consent_text, consent_version from forms where embed_key = ${embedKey}
  `;
  const form = formRows[0];
  if (!form || form.status !== "active") {
    return NextResponse.json({ error: "Form not found" }, { status: 404, headers: CORS_HEADERS });
  }
  const workspaceId = form.workspace_id as number;

  let body: SubmitBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: CORS_HEADERS });
  }

  const fields = body.fields ?? {};
  const email = fields.email?.trim().toLowerCase();
  const consentGiven = Boolean(body.consentGiven);
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request.headers.get("user-agent");
  const isSpam = Boolean(body._hp?.trim());

  const dedupeKey = email || JSON.stringify(fields);
  let isDuplicate = false;
  if (!isSpam) {
    const recent = await sql`
      select 1 from form_submissions
      where form_id = ${form.id} and dedupe_key = ${dedupeKey} and created_at > now() - interval '10 minutes'
    `;
    isDuplicate = recent.length > 0;
  }

  const initialStatus = isSpam ? "spam" : isDuplicate ? "duplicate" : "pending";

  const inserted = await sql`
    insert into form_submissions (
      workspace_id, form_id, payload, consent_given, consent_text, consent_version,
      ip_address, user_agent, page_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      status, dedupe_key
    )
    values (
      ${workspaceId}, ${form.id}, ${JSON.stringify(fields)}, ${consentGiven}, ${form.consent_text}, ${form.consent_version},
      ${ipAddress}, ${userAgent}, ${body.pageUrl ?? null},
      ${body.utm?.source ?? null}, ${body.utm?.medium ?? null}, ${body.utm?.campaign ?? null},
      ${body.utm?.term ?? null}, ${body.utm?.content ?? null},
      ${initialStatus}, ${dedupeKey}
    )
    returning id
  `;
  const submissionId = inserted[0].id as number;

  if (initialStatus === "pending" && consentGiven && email) {
    // INB-02: DNC/opt-out intent is checked before any CRM proposal is created.
    const blocked = await isOnDoNotContact(workspaceId, email);
    if (blocked) {
      await sql`update form_submissions set status = 'dnc_blocked' where id = ${submissionId}`;
    } else {
      const existingLead = await sql`
        select id from leads where workspace_id = ${workspaceId} and lower(email) = ${email} limit 1
      `;
      if (existingLead.length > 0) {
        await proposeLeadFromSubmission({
          workspaceId,
          submissionId,
          action: "update",
          fields,
          leadId: existingLead[0].id as number,
          requestedByUserId: null,
        });
      } else {
        const owner = await workspaceOwnerEmail(workspaceId);
        await proposeLeadFromSubmission({
          workspaceId,
          submissionId,
          action: "create",
          fields,
          ownerEmail: owner,
          requestedByUserId: null,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, id: submissionId }, { headers: CORS_HEADERS });
}
