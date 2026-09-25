import { createHash, randomBytes } from "node:crypto";
import type { FetchLike } from "@/lib/email/http";
import { readJson } from "@/lib/email/http";
import { OAuthError, type TokenSet } from "./types";

/** PKCE (RFC 7636): the code can't be redeemed by anyone who didn't start the flow, even if the redirect leaks. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

/** Errors that mean "sign in again", not "try again later". */
const REAUTH = new Set(["invalid_grant", "interaction_required", "consent_required", "login_required", "invalid_token"]);

/**
 * POSTs to a token endpoint and classifies the answer. The error message NEVER includes the request (it holds the client
 * secret, the code and the refresh token) — only the provider's own short error code and description.
 */
export async function postTokenForm(fetchImpl: FetchLike, url: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams(params).toString() });
  } catch {
    throw new OAuthError("Couldn't reach the sign-in provider", "transient");
  }
  const body = ((await readJson(res)) ?? {}) as Record<string, unknown>;
  if (res.ok) return body;
  const code = typeof body.error === "string" ? body.error : "";
  const description = typeof body.error_description === "string" ? body.error_description.split(/\r?\n/)[0].slice(0, 200) : "";
  const message = `${code || `HTTP ${res.status}`}${description ? `: ${description}` : ""}`;
  if (res.status >= 500 || res.status === 429) throw new OAuthError(message, "transient");
  if (REAUTH.has(code)) throw new OAuthError(message, "invalid_grant");
  if (code === "access_denied") throw new OAuthError(message, "access_denied");
  throw new OAuthError(message, "rejected");
}

export function toTokenSet(body: Record<string, unknown>, now: Date): TokenSet {
  if (typeof body.access_token !== "string" || !body.access_token) throw new OAuthError("The provider returned no access token", "rejected");
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : Number(body.expires_in) || 3600;
  return {
    accessToken: body.access_token,
    refreshToken: typeof body.refresh_token === "string" && body.refresh_token ? body.refresh_token : null,
    expiresAt: new Date(now.getTime() + expiresIn * 1000),
    scopes: typeof body.scope === "string" ? body.scope.split(/\s+/).filter(Boolean) : [],
  };
}
