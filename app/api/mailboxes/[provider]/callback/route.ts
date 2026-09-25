import type { NextRequest } from "next/server";
import { createLogger } from "@/lib/log";
import { completeConnect, ConnectError } from "@/lib/domain/mailboxes/connect-service";
import { FLOW_COOKIE } from "@/lib/domain/mailboxes/oauth/flow-state";
import { failed, landing, providerFromSlug, requireConnectActor } from "@/lib/domain/mailboxes/oauth/route-support";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const log = createLogger({ scope: "mailbox.connect.route" });

/**
 * The provider redirects here after consent. Everything is validated in `completeConnect` (CSRF state, same user and workspace,
 * PKCE code exchange, granted scopes, verified identity). This handler only maps the outcome to a redirect — and never puts a
 * provider error message, code or token in the URL: the page shows a fixed sentence per error code.
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const target = providerFromSlug((await ctx.params).provider);
  if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown mailbox provider." } }, { status: 404 });

  const actor = await requireConnectActor(target.slug);
  if (!actor.ok) return actor.response;

  const q = request.nextUrl.searchParams;
  try {
    const done = await completeConnect({
      workspaceId: actor.ctx.workspaceId, userId: actor.ctx.userId, provider: target.provider,
      query: { code: q.get("code"), state: q.get("state"), error: q.get("error") }, cookie: request.cookies.get(FLOW_COOKIE)?.value,
    });
    return landing({ mailbox_connected: target.slug, mailbox: String(done.mailboxId), outcome: done.outcome }, { clearCookie: true });
  } catch (e) {
    if (e instanceof ConnectError) {
      // `e.message` may carry the provider's short error code; it never contains credentials (see oauth/common.ts).
      log.warn("mailbox.connect.failed", { workspace_id: actor.ctx.workspaceId, provider: target.provider, code: e.code, detail: e.message });
      return failed(e.code, target.slug, { clearCookie: true });
    }
    log.error("mailbox.connect.unexpected", { workspace_id: actor.ctx.workspaceId, provider: target.provider, err: e });
    return failed("provider_error", target.slug, { clearCookie: true });
  }
}
