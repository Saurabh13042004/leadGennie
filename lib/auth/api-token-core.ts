import { createHash, randomBytes } from "node:crypto";

/**
 * Workspace API tokens (used by the Chrome extension) are stored as a SHA-256
 * hash — the plaintext is shown to the user exactly once, at creation. The
 * tokens are 192-bit random values, so an unsalted hash is a sound lookup key
 * (this is not a password). Plain module, not a server-action file, so it can
 * export sync helpers.
 */
export function generateApiToken(): string {
  return `lg_${randomBytes(24).toString("hex")}`;
}

export function hashApiToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Short, non-secret prefix kept for display ("lg_1a2b3c…"). */
export function apiTokenPrefix(token: string): string {
  return token.slice(0, 8);
}
