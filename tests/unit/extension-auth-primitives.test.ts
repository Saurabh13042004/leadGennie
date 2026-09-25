import { describe, expect, it } from "vitest";
import { OFFICIAL_EXTENSION_ID, allowedExtensionIds, checkExtensionRedirect } from "@/lib/extension/config";
import { EXTENSION_SCOPES, roleAllowsScope, scopesForRole } from "@/lib/extension/scopes";
import {
  challengeFromVerifier, generateAuthCode, generateSessionToken, hashSecret, isValidChallenge, isValidVerifier, tokenPrefix, verifierMatchesChallenge,
} from "@/lib/extension/tokens";

describe("PKCE", () => {
  // The worked example from RFC 7636 appendix B — proves we implement the standard, not a lookalike.
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";

  it("matches the RFC 7636 test vector", () => {
    expect(challengeFromVerifier(verifier)).toBe(challenge);
    expect(verifierMatchesChallenge(verifier, challenge)).toBe(true);
  });

  it("rejects a wrong verifier, a truncated challenge and an empty one", () => {
    expect(verifierMatchesChallenge(`${verifier}x`, challenge)).toBe(false);
    expect(verifierMatchesChallenge(verifier, challenge.slice(1))).toBe(false);
    expect(verifierMatchesChallenge(verifier, "")).toBe(false);
  });

  it("validates verifier and challenge shapes", () => {
    expect(isValidVerifier(verifier)).toBe(true);
    expect(isValidVerifier("short")).toBe(false);
    expect(isValidVerifier(`${verifier}!`)).toBe(false);
    expect(isValidVerifier("a".repeat(129))).toBe(false);
    expect(isValidChallenge(challenge)).toBe(true);
    expect(isValidChallenge("nope")).toBe(false);
  });
});

describe("secrets", () => {
  it("are high-entropy, unique and recognisable; only a hash is ever stored", () => {
    const t = generateSessionToken();
    expect(t).toMatch(/^lgx_[0-9a-f]{48}$/);
    expect(generateSessionToken()).not.toBe(t);
    expect(generateAuthCode()).toMatch(/^lgc_[A-Za-z0-9_-]{43}$/);
    expect(hashSecret(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret(t)).not.toContain(t.slice(4, 20));
    expect(tokenPrefix(t)).toBe(t.slice(0, 8));
  });
});

describe("checkExtensionRedirect — only our extension may receive a code", () => {
  const good = `https://${OFFICIAL_EXTENSION_ID}.chromiumapp.org/connect`;
  const other = `https://${"a".repeat(32)}.chromiumapp.org/connect`;

  it("accepts the official extension's redirect address", () => {
    expect(checkExtensionRedirect(good)).toEqual({ ok: true, extensionId: OFFICIAL_EXTENSION_ID });
  });

  const rejected: [string, string][] = [
    ["another extension", other],
    ["a web page", "https://evil.example.com/cb"],
    ["plain http", `http://${OFFICIAL_EXTENSION_ID}.chromiumapp.org/x`],
    ["a lookalike host", `https://${OFFICIAL_EXTENSION_ID}.chromiumapp.org.evil.com/x`],
    ["credentials in the URL", `https://user:pw@${OFFICIAL_EXTENSION_ID}.chromiumapp.org/x`],
    ["a port", `https://${OFFICIAL_EXTENSION_ID}.chromiumapp.org:8443/x`],
    ["a fragment", `${good}#frag`],
    ["a javascript: URL", "javascript:alert(1)"],
    ["garbage", "not a url"],
    ["the empty string", ""],
  ];
  it.each(rejected)("rejects %s", (_name, uri) => {
    expect(checkExtensionRedirect(uri).ok).toBe(false);
  });

  it("lets a Web Store build in through EXTENSION_ALLOWED_IDS, and ignores malformed ids", () => {
    const storeId = "b".repeat(32);
    const ids = allowedExtensionIds(`${storeId}, not-an-id,${storeId.toUpperCase()}`);
    expect(ids).toEqual([OFFICIAL_EXTENSION_ID, storeId]);
    expect(checkExtensionRedirect(`https://${storeId}.chromiumapp.org/x`, ids).ok).toBe(true);
  });
});

describe("scopes are a ceiling; the role is checked too", () => {
  it("viewers read only; members can capture and research; automation only with the flag", () => {
    expect(scopesForRole("viewer", { automation: false })).toEqual(["leads:read"]);
    expect(scopesForRole("member", { automation: false })).toEqual(["leads:read", "leads:create", "research:trigger"]);
    expect(scopesForRole("member", { automation: true })).toEqual([...EXTENSION_SCOPES]);
    expect(scopesForRole("viewer", { automation: true })).toEqual(["leads:read"]);
  });

  it("roleAllowsScope follows the role ranking", () => {
    expect(roleAllowsScope("viewer", "leads:create")).toBe(false);
    expect(roleAllowsScope("member", "leads:create")).toBe(true);
    expect(roleAllowsScope("owner", "research:trigger")).toBe(true);
    expect(roleAllowsScope("viewer", "leads:read")).toBe(true);
  });
});
