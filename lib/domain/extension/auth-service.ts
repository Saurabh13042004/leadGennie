import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { hashApiToken } from "@/lib/auth/api-token-core";
import * as repo from "@/lib/db/extension-sessions";
import { checkExtensionRedirect } from "@/lib/extension/config";
import { roleAllowsScope, scopesForRole, type ExtensionScope, isExtensionScope } from "@/lib/extension/scopes";
import {
  generateAuthCode, generateSessionToken, hashSecret, isValidChallenge, isValidVerifier, tokenPrefix, verifierMatchesChallenge,
} from "@/lib/extension/tokens";
import type { Role } from "@/lib/workspace";

/**
 * The extension connect flow (OAuth 2.0 authorization-code + PKCE, specialised for a browser extension):
 *
 *   extension ── launchWebAuthFlow ──▶ /dashboard/extension/authorize?redirect_uri&state&code_challenge
 *   signed-in user approves ─▶ approveConnection()  mints a one-time code, redirects to the extension
 *   extension ── POST /api/extension/auth/token {code, code_verifier} ──▶ exchangeCode()  → its own token
 *
 * The user never copies a secret, the token is per person and per browser, and it can be revoked from Settings.
 */

export const AUTH_CODE_TTL_SECONDS = 120;
export const SESSION_TTL_DAYS = 90;

export const connectParamsSchema = z.object({
  redirect_uri: z.string().min(1).max(300),
  state: z.string().min(8).max(200),
  code_challenge: z.string().refine(isValidChallenge, "code_challenge must be a base64url SHA-256 digest"),
  device: z.string().trim().max(80).optional(),
});
export type ConnectParams = z.infer<typeof connectParamsSchema>;

/** Validates the query string the extension sent. Anything odd is refused before the user is even asked. */
export function parseConnectParams(raw: unknown, allowedIds?: string[]): ConnectParams {
  const parsed = connectParamsSchema.safeParse(raw);
  if (!parsed.success) throw new AppError("VALIDATION_ERROR", "This connection request is malformed. Start again from the extension.");
  const check = checkExtensionRedirect(parsed.data.redirect_uri, allowedIds);
  if (!check.ok) throw new AppError("FORBIDDEN", check.reason);
  return parsed.data;
}

export type Approver = { workspaceId: number; userId: number; role: Role };
export type Clock = () => Date;

/** The user clicked Approve. Returns where to send the browser: back to the extension with a one-time code. */
export async function approveConnection(
  who: Approver,
  params: ConnectParams,
  opts: { automationEnabled: boolean; now?: Clock; allowedIds?: string[] } = { automationEnabled: false },
): Promise<{ redirectTo: string; scopes: ExtensionScope[] }> {
  const valid = parseConnectParams(params, opts.allowedIds);
  const now = (opts.now ?? (() => new Date()))();
  const scopes = scopesForRole(who.role, { automation: opts.automationEnabled });
  const code = generateAuthCode();

  await repo.insertAuthCode({
    workspaceId: who.workspaceId,
    userId: who.userId,
    codeHash: hashSecret(code),
    codeChallenge: valid.code_challenge,
    redirectUri: valid.redirect_uri,
    scopes,
    deviceLabel: valid.device?.trim() || null,
    expiresAt: new Date(now.getTime() + AUTH_CODE_TTL_SECONDS * 1000),
  });

  const url = new URL(valid.redirect_uri);
  url.searchParams.set("code", code);
  url.searchParams.set("state", valid.state);
  return { redirectTo: url.toString(), scopes };
}

/** The user clicked Cancel: tell the extension, standard OAuth error. */
export function denyRedirect(params: ConnectParams, allowedIds?: string[]): string {
  const valid = parseConnectParams(params, allowedIds);
  const url = new URL(valid.redirect_uri);
  url.searchParams.set("error", "access_denied");
  url.searchParams.set("state", valid.state);
  return url.toString();
}

export const exchangeSchema = z.object({
  code: z.string().min(10).max(200),
  code_verifier: z.string().refine(isValidVerifier, "code_verifier is invalid"),
  redirect_uri: z.string().min(1).max(300),
});

export type ExchangeResult = {
  accessToken: string;
  expiresAt: string;
  scopes: ExtensionScope[];
  user: { id: number; name: string; email: string; role: Role };
  workspace: { id: number; name: string };
};

const INVALID_GRANT = () => new AppError("BAD_REQUEST", "This connection request expired or was already used. Start again from the extension.");

export async function exchangeCode(input: z.infer<typeof exchangeSchema>, opts: { now?: Clock } = {}): Promise<ExchangeResult> {
  const now = (opts.now ?? (() => new Date()))();
  const grant = await repo.consumeAuthCode(hashSecret(input.code));
  if (!grant) throw INVALID_GRANT();
  // The code is now burned whatever happens next: a wrong verifier or redirect gets exactly one try.
  if (grant.redirectUri !== input.redirect_uri || !verifierMatchesChallenge(input.code_verifier, grant.codeChallenge)) {
    throw INVALID_GRANT();
  }

  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000);
  const live = await repo.insertSession({
    workspaceId: grant.workspaceId, userId: grant.userId, tokenHash: hashSecret(token), tokenPrefix: tokenPrefix(token),
    scopes: grant.scopes, deviceLabel: grant.deviceLabel, expiresAt,
  });
  const session = await repo.findLiveSession(hashSecret(token));
  if (!session) throw new AppError("FORBIDDEN", `You're no longer a member of that workspace (session ${live}).`);

  return {
    accessToken: token,
    expiresAt: expiresAt.toISOString(),
    scopes: grant.scopes.filter(isExtensionScope),
    user: { id: session.userId, name: session.userName, email: session.userEmail, role: session.role },
    workspace: { id: session.workspaceId, name: session.workspaceName },
  };
}

/** What every extension endpoint knows about its caller. */
export type ExtensionIdentity = {
  kind: "session" | "legacy";
  workspaceId: number;
  workspaceName: string | null;
  /** null for the legacy workspace token (it identifies a workspace, not a person). */
  userId: number | null;
  userName: string | null;
  role: Role;
  scopes: ExtensionScope[];
  sessionId: number | null;
  /** Rate-limit bucket: one per session, one per workspace for the legacy token. */
  bucket: string;
};

export type LegacyTokenLookup = (tokenHash: string) => Promise<{ workspaceId: number } | null>;

/**
 * Resolves `Authorization: Bearer …`. Session tokens (`lgx_`) are checked against extension_sessions with a
 * LIVE membership/role lookup; anything else is tried as the older workspace token so installs made before
 * this phase keep working until their owner reconnects. Returns null for "not authenticated".
 */
export async function resolveIdentity(
  authorizationHeader: string | null,
  deps: { automationEnabled: boolean; legacyLookup: LegacyTokenLookup },
): Promise<ExtensionIdentity | null> {
  const token = authorizationHeader?.startsWith("Bearer ") ? authorizationHeader.slice(7).trim() : "";
  if (!token) return null;

  if (token.startsWith("lgx_")) {
    const hash = hashSecret(token);
    const s = await repo.findLiveSession(hash);
    if (!s) return null;
    await repo.touchSession(s.workspaceId, s.id, SESSION_TTL_DAYS);
    return {
      kind: "session", workspaceId: s.workspaceId, workspaceName: s.workspaceName, userId: s.userId, userName: s.userName,
      role: s.role, sessionId: s.id, bucket: `ext:s:${s.id}`,
      // A scope is a ceiling: also require the user's CURRENT role to allow it, and the D-05 flag for automation.
      scopes: s.scopes.filter(isExtensionScope).filter((sc) => roleAllowsScope(s.role, sc) && (sc !== "automation" || deps.automationEnabled)),
    };
  }

  const legacy = await deps.legacyLookup(hashApiToken(token));
  if (!legacy) return null;
  return {
    kind: "legacy", workspaceId: legacy.workspaceId, workspaceName: null, userId: null, userName: null, role: "member", sessionId: null,
    bucket: `ext:w:${legacy.workspaceId}`,
    // A workspace token has no user, so it cannot start research (which is attributed to a person).
    scopes: ["leads:read", "leads:create", ...(deps.automationEnabled ? (["automation"] as const) : [])],
  };
}

export async function revokeOwnSession(identity: ExtensionIdentity): Promise<boolean> {
  if (identity.kind !== "session" || identity.sessionId === null || identity.userId === null) return false;
  return repo.revokeSessionRow(identity.workspaceId, identity.sessionId, identity.userId, identity.userId);
}
