import { z } from "zod";
import { AppError, ok, parseJson, withApi } from "@/lib/api";
import { sql } from "@/lib/db/client";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";

export const dynamic = "force-dynamic";

export const GET = withApi(async (request) => {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) throw new AppError("UNAUTHENTICATED", "Unauthorized");
  const { workspaceId } = auth;

  const rows = await sql`
    select
      cs.id, cs.body, cs.scheduled_at,
      l.full_name as lead_name, l.linkedin_url, l.company, l.job_title,
      c.name as campaign_name
    from campaign_sends cs
    join leads l on l.id = cs.lead_id
    join campaigns c on c.id = cs.campaign_id
    where cs.workspace_id = ${workspaceId}
      and cs.channel = 'linkedin_dm'
      and cs.status = 'queued'
    order by cs.scheduled_at asc
    limit 50
  `;

  return ok({ items: rows });
});

const ReportBody = z.object({
  id: z.number().int().positive("id is required"),
  status: z.enum(["sent", "failed"], { message: "status must be 'sent' or 'failed'" }),
  error: z.string().max(500).optional(),
});

export const POST = withApi(async (request) => {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) throw new AppError("UNAUTHENTICATED", "Unauthorized");
  const { workspaceId } = auth;

  const { id, status, error } = await parseJson(request, ReportBody);

  const rows = await sql`
    select cs.id, cs.campaign_id
    from campaign_sends cs
    where cs.id = ${id} and cs.workspace_id = ${workspaceId}
  `;
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Send not found");

  if (status === "sent") {
    // Idempotent: a repeated "sent" report must not double-count.
    const changed = await sql`
      update campaign_sends set status = 'sent', sent_at = now()
      where id = ${id} and workspace_id = ${workspaceId} and status <> 'sent'
      returning id
    `;
    if (changed.length > 0) {
      await sql`
        update campaigns set sent_count = sent_count + 1
        where id = ${rows[0].campaign_id} and workspace_id = ${workspaceId}
      `;
    }
  } else {
    await sql`
      update campaign_sends set status = 'failed', error_message = ${error ?? "Marked failed by extension"}
      where id = ${id} and workspace_id = ${workspaceId}
    `;
  }

  return ok();
});
