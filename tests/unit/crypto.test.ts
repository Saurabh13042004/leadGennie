import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const original = process.env.CREDENTIALS_ENCRYPTION_KEY;
afterEach(() => {
  process.env.CREDENTIALS_ENCRYPTION_KEY = original;
});

describe("credential encryption (AES-256-GCM)", () => {
  it("round-trips, including unicode and long values", () => {
    for (const secret of ["hubspot-token", "pässwörd ✓ 日本語", "x".repeat(5000)]) {
      expect(decryptSecret(encryptSecret(secret))).toBe(secret);
    }
  });

  it("never stores plaintext, and uses a fresh IV each time", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toContain("same");
    expect(a).not.toBe(b);
    expect(a.startsWith("v1:")).toBe(true);
  });

  it("detects tampering (GCM auth tag)", () => {
    const parts = encryptSecret("secret").split(":");
    const ct = Buffer.from(parts[3], "base64");
    ct[0] ^= 0xff;
    parts[3] = ct.toString("base64");
    expect(() => decryptSecret(parts.join(":"))).toThrow();
  });

  it("cannot be decrypted with a different key", () => {
    const enc = encryptSecret("secret");
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
    expect(() => decryptSecret(enc)).toThrow();
  });

  it("rejects malformed input and bad keys", () => {
    expect(() => decryptSecret("not-encrypted")).toThrow(/Malformed/);
    process.env.CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
    expect(() => encryptSecret("x")).toThrow(/32-byte/);
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow(/not set/);
  });
});
