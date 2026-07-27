import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(workspaceId: number, email: string): string {
  return createHmac("sha256", secret())
    .update(`${workspaceId}:${email.toLowerCase()}`)
    .digest("base64url")
    .slice(0, 22);
}

export function buildUnsubscribeUrl(baseUrl: string, workspaceId: number, email: string): string {
  const token = sign(workspaceId, email);
  const url = new URL("/api/unsubscribe", baseUrl);
  url.searchParams.set("w", String(workspaceId));
  url.searchParams.set("e", email);
  url.searchParams.set("t", token);
  return url.toString();
}

export function verifyUnsubscribeToken(workspaceId: number, email: string, token: string): boolean {
  const expected = sign(workspaceId, email);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
