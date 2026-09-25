import { suppressEmail } from "@/lib/domain/sending/suppression";
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

async function unsubscribe(url: URL): Promise<{ ok: true; email: string } | { ok: false; status: number; message: string; server?: boolean }> {
  const workspaceId = Number(url.searchParams.get("w"));
  const email = url.searchParams.get("e");
  const token = url.searchParams.get("t");
  if (!workspaceId || !email || !token || !verifyUnsubscribeToken(workspaceId, email, token)) {
    return { ok: false, status: 400, message: "This unsubscribe link is invalid or has expired." };
  }
  try {
    // Idempotent: adds to Do Not Contact and stops this address in EVERY campaign of the workspace, immediately.
    await suppressEmail(workspaceId, email, { reason: "Unsubscribed via email link", source: "unsubscribe_link", leadStatus: "unsubscribed" });
  } catch (err) {
    createLogger({ path: "/api/unsubscribe" }).error("unsubscribe.failed", { err, workspace_id: workspaceId });
    return { ok: false, status: 500, message: "We couldn't process your request. Please try the link again in a moment.", server: true };
  }
  return { ok: true, email };
}

/** Human clicks the link in the email body. */
export async function GET(request: Request) {
  const r = await unsubscribe(new URL(request.url));
  if (!r.ok) return htmlResponse(r.server ? "Something went wrong" : "Invalid link", r.message, r.status);
  return htmlResponse("You're unsubscribed", `${r.email} won't receive further outreach from this workspace.`);
}

/**
 * RFC 8058 one-click unsubscribe: mail clients (Gmail, Yahoo, Apple Mail) POST `List-Unsubscribe=One-Click` to the URL from
 * the `List-Unsubscribe` header. Same signed token, same effect; a plain 200 for the machine caller.
 */
export async function POST(request: Request) {
  const r = await unsubscribe(new URL(request.url));
  if (!r.ok) return new Response(r.message, { status: r.status });
  return new Response("Unsubscribed", { status: 200 });
}
