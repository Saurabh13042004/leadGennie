import { ok, parseJson, withApi } from "@/lib/api";
import { addressBucket, checkRateLimit } from "@/lib/api/rate-limit";
import { exchangeCode, exchangeSchema } from "@/lib/domain/extension/auth-service";
import { extensionFeatures } from "@/lib/extension/features";

export const dynamic = "force-dynamic";

/**
 * POST /api/extension/auth/token — the extension trades its one-time code (+ PKCE verifier) for its own token.
 * Public by design (there is nothing to authenticate with yet), so it is rate-limited per address and the code
 * is single-use, short-lived, and bound to the verifier only the extension holds.
 */
export const POST = withApi(async (request) => {
  await checkRateLimit(`ext:token:${addressBucket(request)}`, { limit: 20, windowSeconds: 60 });
  const body = await parseJson(request, exchangeSchema);
  const r = await exchangeCode(body);
  return ok(
    {
      access_token: r.accessToken,
      token_type: "Bearer",
      expires_at: r.expiresAt,
      scopes: r.scopes,
      user: r.user,
      workspace: r.workspace,
      features: extensionFeatures(),
    },
    { headers: { "cache-control": "no-store" } },
  );
});
