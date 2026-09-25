import { NextResponse } from "next/server";
import { appBaseUrl } from "@/lib/campaigns/render";
import { AppError } from "@/lib/api/errors";
import { requireRole } from "@/lib/auth/workspace-context";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";
import { FLOW_COOKIE } from "./flow-state";
import type { ConnectErrorCode } from "./messages";
import { isOAuthSlug, OAUTH_SLUGS, type OAuthSlug } from "./slug";
import type { OAuthMailboxProvider } from "../types";

/** Where every connect/callback outcome lands. The page turns `?mailbox_error=<code>` into a sentence (oauth/messages.ts). */
export const MAILBOXES_PATH = "/dashboard/deliverability";

export function landing(params: Record<string, string>, opts: { clearCookie?: boolean } = {}): NextResponse {
  const url = new URL(MAILBOXES_PATH, appBaseUrl());
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = NextResponse.redirect(url);
  if (opts.clearCookie) res.cookies.set(FLOW_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 0, path: "/" });
  return res;
}

export const failed = (code: ConnectErrorCode, provider?: OAuthSlug, opts?: { clearCookie?: boolean }) =>
  landing({ mailbox_error: code, ...(provider ? { provider } : {}) }, opts);

/** `/api/mailboxes/<slug>/…` → the provider, or null for a slug we don't have (the caller answers 404). */
export function providerFromSlug(slug: string): { slug: OAuthSlug; provider: OAuthMailboxProvider } | null {
  return isOAuthSlug(slug) ? { slug, provider: OAUTH_SLUGS[slug] } : null;
}

export type ConnectActor = { ok: true; ctx: WorkspaceContext } | { ok: false; response: NextResponse };

/**
 * Connecting a mailbox lets LeadGennie send as a person, so it needs an owner or admin. Not signed in → the sign-in page (routes
 * live under /api, which the sign-in proxy doesn't cover); signed in but not allowed → back to the page with an explanation.
 */
export async function requireConnectActor(slug: OAuthSlug): Promise<ConnectActor> {
  try {
    return { ok: true, ctx: await requireRole("admin") };
  } catch (e) {
    if (e instanceof AppError && e.code === "UNAUTHENTICATED") return { ok: false, response: NextResponse.redirect(new URL("/login", appBaseUrl())) };
    if (e instanceof AppError && e.code === "FORBIDDEN") return { ok: false, response: failed("forbidden", slug) };
    throw e;
  }
}
