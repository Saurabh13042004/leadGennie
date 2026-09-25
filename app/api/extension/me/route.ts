import { ok } from "@/lib/api";
import { extensionFeatures } from "@/lib/extension/features";
import { extensionRoute } from "@/lib/extension/route";

export const dynamic = "force-dynamic";

/** GET /api/extension/me — who is connected, what they may do, and what the server supports. Doubles as "Test connection". */
export const GET = extensionRoute({}, async (_request, identity) =>
  ok({
    kind: identity.kind,
    user: identity.userId === null ? null : { id: identity.userId, name: identity.userName, role: identity.role },
    workspace: { id: identity.workspaceId, name: identity.workspaceName },
    scopes: identity.scopes,
    features: extensionFeatures(),
  }),
);
