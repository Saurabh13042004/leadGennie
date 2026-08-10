import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { extensionAuthFromRequest } from "@/lib/auth/extension-token";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json({ items: rows });
}

export async function POST(request: Request) {
  const auth = await extensionAuthFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { workspaceId } = auth;

  const body = await request.json();
  const { id, status, error } = body as { id?: number; status?: "sent" | "failed"; error?: string };

  if (!id || (status !== "sent" && status !== "failed")) {
    return NextResponse.json({ error: "id and status ('sent' | 'failed') are required" }, { status: 400 });
  }

  const rows = await sql`
    select cs.id, cs.campaign_id
    from campaign_sends cs
    where cs.id = ${id} and cs.workspace_id = ${workspaceId}
  `;
  if (rows.length === 0) {
    return NextResponse.json({ error: "Send not found" }, { status: 404 });
  }

  if (status === "sent") {
    await sql`
      update campaign_sends set status = 'sent', sent_at = now() where id = ${id}
    `;
    await sql`
      update campaigns set sent_count = sent_count + 1 where id = ${rows[0].campaign_id}
    `;
  } else {
    await sql`
      update campaign_sends set status = 'failed', error_message = ${error ?? "Marked failed by extension"}
      where id = ${id}
    `;
  }

  return NextResponse.json({ ok: true });
}
