import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { buildHubspotAuthorizeUrl } from "@/lib/hubspot";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const origin = new URL(request.url).origin;
  const redirectUri = `${origin}/api/integrations/hubspot/callback`;
  const state = randomUUID();

  let authorizeUrl: string;
  try {
    authorizeUrl = buildHubspotAuthorizeUrl(redirectUri, state);
  } catch (err) {
    const integrationsUrl = new URL("/dashboard/integrations", origin);
    integrationsUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "hubspot_not_configured"
    );
    return NextResponse.redirect(integrationsUrl);
  }

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set("hubspot_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  return response;
}
