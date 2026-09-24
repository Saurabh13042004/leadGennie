import { sql } from "@/lib/db/client";
import { createLogger } from "@/lib/log";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

// Human-facing page (recipients click this from an email) — so errors here are
// HTML, not the JSON envelope the machine-facing routes use.
function htmlResponse(title: string, message: string, status = 200) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>body{font-family:system-ui,sans-serif;background:#050505;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px}
    div{max-width:420px}h1{font-size:1.25rem}p{color:#a3a3a3}</style></head>
    <body><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></div></body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const workspaceId = Number(url.searchParams.get("w"));
  const email = url.searchParams.get("e");
  const token = url.searchParams.get("t");

  if (!workspaceId || !email || !token || !verifyUnsubscribeToken(workspaceId, email, token)) {
    return htmlResponse("Invalid link", "This unsubscribe link is invalid or has expired.", 400);
  }

  try {
    await sql`
      insert into do_not_contact (workspace_id, email, reason, source)
      values (${workspaceId}, ${email.toLowerCase()}, 'Unsubscribed via email link', 'unsubscribe_link')
      on conflict (workspace_id, lower(email)) do nothing
    `;
  } catch (err) {
    createLogger({ path: "/api/unsubscribe" }).error("unsubscribe.failed", { err, workspace_id: workspaceId });
    return htmlResponse("Something went wrong", "We couldn't process your request. Please try the link again in a moment.", 500);
  }

  return htmlResponse("You're unsubscribed", `${email} won't receive further outreach from this workspace.`);
}
