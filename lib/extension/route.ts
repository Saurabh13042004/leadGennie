import { AppError, withApi, type ApiContext } from "@/lib/api";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { sql } from "@/lib/db/client";
import { resolveIdentity, type ExtensionIdentity } from "@/lib/domain/extension/auth-service";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
import { roleAllowsScope, type ExtensionScope } from "./scopes";

/**
 * Wraps a /api/extension/* handler: request id + envelope errors (withApi), authentication, per-token rate
 * limiting, and a scope + live-role check — in that order, so an unauthenticated caller learns nothing.
 * Every extension endpoint is built with this, so they cannot drift into different auth behaviour.
 */
export type ExtensionRouteOptions = {
  /** Scope required; omit for endpoints any connected extension may call (e.g. /me). */
  scope?: ExtensionScope;
  /** Requests per minute for this endpoint's bucket. Default 240 (a busy popup + page widget). */
  perMinute?: number;
  /** Extra tighter bucket for expensive endpoints (e.g. LLM extraction): requests per minute. */
  expensivePerMinute?: number;
};

/** The workspace-token lookup the older installs use. Touches last_used_at like the dashboard promises. */
async function legacyTokenLookup(tokenHash: string): Promise<{ workspaceId: number } | null> {
  // workspace-scope-ok: looked up by the hash of the secret token; the row it returns IS the tenant boundary
  const rows = await sql`update api_tokens set last_used_at = now() where token_hash = ${tokenHash} returning workspace_id`;
  return rows[0] ? { workspaceId: Number(rows[0].workspace_id) } : null;
}

export async function authenticateExtension(request: Request, opts: ExtensionRouteOptions = {}): Promise<ExtensionIdentity> {
  const identity = await resolveIdentity(request.headers.get("authorization"), {
    automationEnabled: linkedinAutomationEnabled(),
    legacyLookup: legacyTokenLookup,
  });
  if (!identity) throw new AppError("UNAUTHENTICATED", "Unauthorized");

  await checkRateLimit(identity.bucket, { limit: opts.perMinute ?? 240, windowSeconds: 60 });
  if (opts.expensivePerMinute) await checkRateLimit(`${identity.bucket}:expensive`, { limit: opts.expensivePerMinute, windowSeconds: 60 });

  if (opts.scope) {
    // Role first: it is the reason a demoted person is refused, and the message should say so.
    if (!roleAllowsScope(identity.role, opts.scope)) {
      throw new AppError("FORBIDDEN", `Your role in this workspace (${identity.role}) can't do that.`);
    }
    if (!identity.scopes.includes(opts.scope)) {
      throw new AppError("FORBIDDEN", "This connection doesn't allow that. Reconnect the extension from its settings.");
    }
  }
  return identity;
}

type Handler<C> = (request: Request, identity: ExtensionIdentity, api: ApiContext, routeCtx: C) => Promise<Response>;

export function extensionRoute<C = unknown>(opts: ExtensionRouteOptions, handler: Handler<C>) {
  return withApi<C>(async (request, routeCtx, api) => {
    const identity = await authenticateExtension(request, opts);
    return handler(request, identity, api, routeCtx);
  });
}
