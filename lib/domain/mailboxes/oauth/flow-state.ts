import { randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import type { OAuthMailboxProvider } from "../types";
import type { ScopeGroup } from "../scopes";

/**
 * The state of one in-flight OAuth connection, kept in an httpOnly cookie between "Connect" and the provider's redirect back.
 *
 * It is AES-256-GCM sealed (the same key as stored credentials), so the browser can neither read the PKCE verifier nor forge
 * or alter who the flow belongs to. The `state` query parameter is only the random nonce; the callback must present the cookie
 * whose nonce matches — that is the CSRF check — and the same signed-in user and workspace that started it.
 */

export const FLOW_COOKIE = "lg_mailbox_oauth";
export const FLOW_TTL_SECONDS = 10 * 60;

export type FlowState = {
  nonce: string;
  provider: OAuthMailboxProvider;
  workspaceId: number;
  userId: number;
  /** Set when reconnecting an existing mailbox: the callback must sign in as that same account. */
  mailboxId: number | null;
  scopeGroups: ScopeGroup[];
  codeVerifier: string;
  expiresAt: number;
};

export type FlowFailure = "state_invalid" | "state_expired" | "state_mismatch";

export class FlowError extends Error {
  constructor(readonly code: FlowFailure) {
    super(code);
    this.name = "FlowError";
  }
}

export const newNonce = () => randomBytes(24).toString("base64url");

export function sealFlowState(state: FlowState): string {
  return encryptSecret(JSON.stringify(state));
}

const safeEqual = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Opens the cookie and checks it against the callback's `state` parameter, the signed-in user/workspace and the clock. */
export function openFlowState(
  cookie: string | undefined,
  received: { state: string | null; provider: OAuthMailboxProvider; workspaceId: number; userId: number; now: number },
): FlowState {
  if (!cookie || !received.state) throw new FlowError("state_invalid");
  let s: FlowState;
  try {
    s = JSON.parse(decryptSecret(cookie)) as FlowState;
  } catch {
    throw new FlowError("state_invalid"); // tampered, truncated, or sealed with a different key
  }
  if (typeof s.nonce !== "string" || !safeEqual(s.nonce, received.state)) throw new FlowError("state_invalid");
  if (s.expiresAt < received.now) throw new FlowError("state_expired");
  // A callback replayed into another provider's route, another user's session, or another workspace is not this flow.
  if (s.provider !== received.provider || s.workspaceId !== received.workspaceId || s.userId !== received.userId) throw new FlowError("state_mismatch");
  return s;
}
