import { NextResponse, type NextRequest } from "next/server";
import { createLogger } from "@/lib/log";
import { ConnectError, startConnect } from "@/lib/domain/mailboxes/connect-service";
import { failed, providerFromSlug, requireConnectActor } from "@/lib/domain/mailboxes/oauth/route-support";
import type { ScopeGroup } from "@/lib/domain/mailboxes/scopes";

export const dynamic = "force-dynamic";

const log = createLogger({ scope: "mailbox.connect.route" });

/**
 * Starts connecting (or reconnecting, with ?mailboxId=) a Google or Microsoft mailbox: builds the provider's consent URL, sets the
 * sealed httpOnly state cookie, redirects. Nothing is stored yet — the mailbox only exists once the callback validates the answer.
 *   GET /api/mailboxes/google/connect            GET /api/mailboxes/microsoft/connect?mailboxId=12
 */
export async function GET(request: NextRequest, ctx: { params: Promise<{ provider: string }> }) {
  const target = providerFromSlug((await ctx.params).provider);
  if (!target) return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown mailbox provider." } }, { status: 404 });

  const actor = await requireConnectActor(target.slug);
  if (!actor.ok) return actor.response;

  const rawId = request.nextUrl.searchParams.get("mailboxId");
  const mailboxId = rawId === null ? null : Number(rawId);
  if (mailboxId !== null && (!Number.isInteger(mailboxId) || mailboxId <= 0)) return failed("target_missing", target.slug);
  // Asking for inbox access is how a mailbox opts into reading mail (Inbox phase); sending alone never requests it.
  const scopeGroups: ScopeGroup[] = request.nextUrl.searchParams.get("inbox") === "1" ? ["send", "inbox"] : ["send"];

  try {
    const { authorizeUrl, cookie } = await startConnect({ workspaceId: actor.ctx.workspaceId, userId: actor.ctx.userId, provider: target.provider, mailboxId, scopeGroups });
    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set(cookie.name, cookie.value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: cookie.maxAge, path: "/" });
    return res;
  } catch (e) {
    if (e instanceof ConnectError) return failed(e.code, target.slug);
    log.error("mailbox.connect.start_failed", { workspace_id: actor.ctx.workspaceId, provider: target.provider, err: e });
    return failed("provider_error", target.slug);
  }
}
