import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { apiTokenPrefix, generateApiToken, hashApiToken } from "@/lib/auth/api-token-core";

describe("API token helpers", () => {
  it("generates high-entropy, unique, recognisable tokens", () => {
    const a = generateApiToken();
    expect(a).toMatch(/^lg_[0-9a-f]{48}$/);
    expect(generateApiToken()).not.toBe(a);
  });

  it("hashes deterministically to 64 hex chars and never contains the token", () => {
    const t = generateApiToken();
    expect(hashApiToken(t)).toBe(hashApiToken(t));
    expect(hashApiToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiToken(t)).not.toContain(t.slice(3, 20));
    expect(hashApiToken(t)).not.toBe(hashApiToken(`${t}x`));
  });

  it("is plain SHA-256 of the UTF-8 token (the same function migration 0004 applies in SQL)", () => {
    expect(hashApiToken("abcdef0123456789")).toBe(createHash("sha256").update("abcdef0123456789").digest("hex"));
  });

  it("keeps only a short display prefix", () => {
    expect(apiTokenPrefix("lg_1234567890")).toBe("lg_12345");
  });
});
