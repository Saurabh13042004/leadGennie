import { ok } from "@/lib/api";
import { revokeOwnSession } from "@/lib/domain/extension/auth-service";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

/** POST /api/extension/auth/revoke — "Disconnect" in the extension: this browser's token stops working immediately. */
export const POST = extensionRoute({}, async (_request, identity) => {
  const revoked = await revokeOwnSession(identity);
  return ok({ revoked });
});
