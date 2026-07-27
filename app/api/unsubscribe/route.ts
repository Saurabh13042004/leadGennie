import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

function htmlResponse(title: string, message: string) {
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{font-family:system-ui,sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
    div{max-width:420px}h1{font-size:1.25rem}p{color:#a3a3a3}</style></head>
    <body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = Number(url.searchParams.get("w"));
  const email = url.searchParams.get("e");
  const token = url.searchParams.get("t");

  if (!workspaceId || !email || !token || !verifyUnsubscribeToken(workspaceId, email, token)) {
    return htmlResponse("Invalid link", "This unsubscribe link is invalid or has expired.");
  }

  await sql`
    insert into do_not_contact (workspace_id, email, reason, source)
    values (${workspaceId}, ${email.toLowerCase()}, 'Unsubscribed via email link', 'unsubscribe_link')
    on conflict (workspace_id, lower(email)) do nothing
  `;

  return htmlResponse("You're unsubscribed", `${email} won't receive further outreach from this workspace.`);
}
