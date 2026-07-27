import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sql } from "@/lib/db/client";
import { exchangeHubspotCode, fetchHubspotTokenInfo } from "@/lib/hubspot";
import { encryptSecret } from "@/lib/crypto";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = url.origin;
  const integrationsUrl = new URL("/dashboard/integrations", origin);

  const session = await auth();
  if (!session?.user?.email || !session.user.workspaceId) {
    return NextResponse.redirect(new URL("/login", origin));
  }
  if (session.user.role !== "owner" && session.user.role !== "admin") {
    integrationsUrl.searchParams.set("error", "hubspot_requires_admin");
    return NextResponse.redirect(integrationsUrl);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = request.headers
    .get("cookie")
    ?.split("; ")
    .find((c) => c.startsWith("hubspot_oauth_state="))
    ?.split("=")[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    integrationsUrl.searchParams.set("error", "hubspot_state_mismatch");
    return NextResponse.redirect(integrationsUrl);
  }

  try {
    const redirectUri = `${origin}/api/integrations/hubspot/callback`;
    const tokens = await exchangeHubspotCode(code, redirectUri);
    const info = await fetchHubspotTokenInfo(tokens.access_token).catch(
      () => ({} as Awaited<ReturnType<typeof fetchHubspotTokenInfo>>)
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const portalId = info.hub_id ? String(info.hub_id) : null;
    const label = info.hub_domain ?? null;
    const scope = info.scopes ? info.scopes.join(" ") : null;

    // INT-01: encrypted before it ever reaches the database — access_token/
    // refresh_token columns hold ciphertext, never the raw OAuth tokens.
    const encryptedAccessToken = encryptSecret(tokens.access_token);
    const encryptedRefreshToken = encryptSecret(tokens.refresh_token);

    await sql`
      insert into crm_connections
        (workspace_id, owner_email, provider, label, portal_id, access_token, refresh_token, scope, expires_at)
      values
        (${session.user.workspaceId}, ${session.user.email}, 'hubspot', ${label}, ${portalId}, ${encryptedAccessToken}, ${encryptedRefreshToken}, ${scope}, ${expiresAt})
      on conflict (workspace_id, provider, portal_id)
      do update set
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        label = excluded.label,
        status = 'connected'
    `;

    integrationsUrl.searchParams.set("connected", "hubspot");
    const response = NextResponse.redirect(integrationsUrl);
    response.cookies.delete("hubspot_oauth_state");
    return response;
  } catch (err) {
    integrationsUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "hubspot_connect_failed"
    );
    const response = NextResponse.redirect(integrationsUrl);
    response.cookies.delete("hubspot_oauth_state");
    return response;
  }
}
