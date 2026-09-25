import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Secrets for the extension connect flow. All are high-entropy random values, so an unsalted SHA-256 is a sound
 * lookup key (same reasoning as lib/auth/api-token-core.ts). Plain module — no server-only imports.
 */

const b64url = (buf: Buffer) => buf.toString("base64url");

/** `lgx_` = a per-user extension session token (the older workspace token is `lg_`). */
export function generateSessionToken(): string {
  return `lgx_${randomBytes(24).toString("hex")}`;
}

export function generateAuthCode(): string {
  return `lgc_${b64url(randomBytes(32))}`;
}

export function hashSecret(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

export function tokenPrefix(token: string): string {
  return token.slice(0, 8);
}

/** PKCE S256: base64url(sha256(verifier)). */
export function challengeFromVerifier(verifier: string): string {
  return b64url(createHash("sha256").update(verifier, "utf8").digest());
}

/** RFC 7636 verifier shape: 43–128 URL-safe characters. */
export function isValidVerifier(v: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(v);
}

/** A challenge is 43 base64url chars (a SHA-256 digest). */
export function isValidChallenge(c: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(c);
}

export function verifierMatchesChallenge(verifier: string, challenge: string): boolean {
  const a = Buffer.from(challengeFromVerifier(verifier));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}
