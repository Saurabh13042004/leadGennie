import { describe, expect, it, vi } from "vitest";
import { GoogleOAuthClient } from "@/lib/domain/mailboxes/oauth/google";
import { MicrosoftOAuthClient } from "@/lib/domain/mailboxes/oauth/microsoft";
import { pkcePair } from "@/lib/domain/mailboxes/oauth/common";
import { FlowError, newNonce, openFlowState, sealFlowState, type FlowState } from "@/lib/domain/mailboxes/oauth/flow-state";
import { redirectUriFor } from "@/lib/domain/mailboxes/oauth/registry";
import { OAuthError, type OAuthProviderClient } from "@/lib/domain/mailboxes/oauth/types";
import { createHash } from "node:crypto";

const env = { GOOGLE_CLIENT_ID: "gid", GOOGLE_CLIENT_SECRET: "gsecret", MICROSOFT_CLIENT_ID: "mid", MICROSOFT_CLIENT_SECRET: "msecret" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const NOW = new Date("2026-05-01T00:00:00Z");
const authorize = { redirectUri: "https://app.test/cb", state: "nonce123", codeChallenge: "chal", scopes: ["openid", "https://www.googleapis.com/auth/gmail.send"] };

describe("Google OAuth client", () => {
  it("builds a consent URL with PKCE, offline access and account selection", () => {
    const url = new URL(new GoogleOAuthClient(env).buildAuthorizeUrl({ ...authorize, loginHint: "me@acme.com" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: "gid", redirect_uri: "https://app.test/cb", response_type: "code", state: "nonce123", code_challenge: "chal", code_challenge_method: "S256",
      access_type: "offline", prompt: "select_account consent", login_hint: "me@acme.com", scope: "openid https://www.googleapis.com/auth/gmail.send",
    });
    expect(url.search).not.toContain("gsecret"); // the client secret never goes through the browser
  });

  it("is unconfigured — and refuses to build URLs — without credentials", () => {
    const c = new GoogleOAuthClient({});
    expect(c.isConfigured()).toBe(false);
    expect(() => c.buildAuthorizeUrl(authorize)).toThrow(OAuthError);
  });

  it("exchanges a code (with the PKCE verifier) and returns the granted scopes", async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: "at", refresh_token: "rt", expires_in: 3600, scope: "openid email https://www.googleapis.com/auth/gmail.send" }));
    const t = await new GoogleOAuthClient(env, fetchImpl, () => NOW).exchangeCode({ code: "the-code", redirectUri: "https://app.test/cb", codeVerifier: "verifier" });
    expect(t).toEqual({ accessToken: "at", refreshToken: "rt", expiresAt: new Date("2026-05-01T01:00:00Z"), scopes: ["openid", "email", "https://www.googleapis.com/auth/gmail.send"] });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(new URLSearchParams(init.body as string).get("code_verifier")).toBe("verifier");
    expect(new URLSearchParams(init.body as string).get("grant_type")).toBe("authorization_code");
  });

  it("refresh returns no refresh token when Google issues none (the caller keeps the old one)", async () => {
    const t = await new GoogleOAuthClient(env, async () => json({ access_token: "at2", expires_in: 3599 }), () => NOW).refresh("rt");
    expect(t.refreshToken).toBeNull();
    expect(t.accessToken).toBe("at2");
  });

  it.each([
    [400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }, "invalid_grant"],
    [400, { error: "access_denied" }, "access_denied"],
    [401, { error: "invalid_client" }, "rejected"],
    [503, { error: "backend_error" }, "transient"],
    [429, {}, "transient"],
  ])("classifies token-endpoint failure %s %j as %s", async (status, body, kind) => {
    await expect(new GoogleOAuthClient(env, async () => json(body, status)).refresh("rt")).rejects.toMatchObject({ name: "OAuthError", kind });
  });

  it("a network failure is transient, and its message never contains the request (secret, code, refresh token)", async () => {
    const err = (await new GoogleOAuthClient(env, async () => { throw new Error("boom gsecret rt"); }).refresh("rt").catch((e) => e)) as OAuthError;
    expect(err.kind).toBe("transient");
    expect(err.message).not.toMatch(/gsecret|rt$/);
  });

  it("a rejected token error message carries only the provider's short code and description", async () => {
    const err = (await new GoogleOAuthClient(env, async () => json({ error: "invalid_grant", error_description: "Bad\nsecond line with detail" }, 400)).refresh("SUPERSECRET").catch((e) => e)) as OAuthError;
    expect(err.message).toBe("invalid_grant: Bad");
  });

  it("revokes the token; an already-revoked token (400) is fine; an outage is reported", async () => {
    const calls: string[] = [];
    await new GoogleOAuthClient(env, async (u, i) => { calls.push(`${u} ${new URLSearchParams(String(i?.body)).get("token")}`); return json({}, 200); }).revoke("rt");
    expect(calls).toEqual(["https://oauth2.googleapis.com/revoke rt"]);
    await expect(new GoogleOAuthClient(env, async () => json({ error: "invalid_token" }, 400)).revoke("rt")).resolves.toBeUndefined();
    await expect(new GoogleOAuthClient(env, async () => json({}, 500)).revoke("rt")).rejects.toMatchObject({ kind: "transient" });
  });
});

describe("Microsoft OAuth client", () => {
  it("builds a consent URL on the configured tenant with PKCE and account selection", () => {
    const url = new URL(new MicrosoftOAuthClient({ ...env, MICROSOFT_TENANT: "contoso.onmicrosoft.com" }).buildAuthorizeUrl({ ...authorize, scopes: ["offline_access", "Mail.Send"] }));
    expect(url.origin + url.pathname).toBe("https://login.microsoftonline.com/contoso.onmicrosoft.com/oauth2/v2.0/authorize");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ client_id: "mid", response_mode: "query", prompt: "select_account", code_challenge_method: "S256", scope: "offline_access Mail.Send" });
    expect(new URL(new MicrosoftOAuthClient(env).buildAuthorizeUrl(authorize)).pathname).toBe("/common/oauth2/v2.0/authorize");
  });

  it("rejects a tenant value that could redirect the request elsewhere", () => {
    expect(() => new MicrosoftOAuthClient({ ...env, MICROSOFT_TENANT: "evil.com/../x?" }).buildAuthorizeUrl(authorize)).toThrow(OAuthError);
  });

  it("uses the rotated refresh token Microsoft returns, and classifies re-auth errors", async () => {
    const t = await new MicrosoftOAuthClient(env, async () => json({ access_token: "a", refresh_token: "NEW", expires_in: 3599, scope: "Mail.Send User.Read" }), () => NOW).refresh("old");
    expect(t.refreshToken).toBe("NEW");
    await expect(new MicrosoftOAuthClient(env, async () => json({ error: "invalid_grant", error_codes: [70008] }, 400)).refresh("old")).rejects.toMatchObject({ kind: "invalid_grant" });
    await expect(new MicrosoftOAuthClient(env, async () => json({ error: "interaction_required" }, 400)).refresh("old")).rejects.toMatchObject({ kind: "invalid_grant" });
  });

  it("has no revoke (Microsoft offers none)", () => {
    expect((new MicrosoftOAuthClient(env) as OAuthProviderClient).revoke).toBeUndefined();
  });
});

describe("PKCE + redirect URI", () => {
  it("challenge is the S256 of the verifier", () => {
    const { verifier, challenge } = pkcePair();
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(verifier.length).toBeGreaterThanOrEqual(43); // RFC 7636 minimum
  });
  it("derives the callback from the app URL unless explicitly set", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://leadgennie.test/";
    expect(redirectUriFor("gmail", {})).toBe("https://leadgennie.test/api/mailboxes/google/callback");
    expect(redirectUriFor("microsoft", {})).toBe("https://leadgennie.test/api/mailboxes/microsoft/callback");
    expect(redirectUriFor("gmail", { GOOGLE_REDIRECT_URI: "https://other.test/cb" })).toBe("https://other.test/cb");
    if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL; else process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});

describe("sealed flow state (CSRF + ownership)", () => {
  const flow = (over: Partial<FlowState> = {}): FlowState => ({
    nonce: newNonce(), provider: "gmail", workspaceId: 1, userId: 7, mailboxId: null, scopeGroups: ["send"], codeVerifier: "verifier-secret", expiresAt: 2_000_000, ...over,
  });
  const ok = (f: FlowState) => ({ state: f.nonce, provider: "gmail" as const, workspaceId: 1, userId: 7, now: 1_000_000 });

  it("round-trips, and the browser-visible cookie does not reveal the PKCE verifier", () => {
    const f = flow();
    const cookie = sealFlowState(f);
    expect(cookie).not.toContain("verifier-secret");
    expect(openFlowState(cookie, ok(f))).toEqual(f);
  });

  it.each([
    ["no cookie", (f: FlowState) => ({ cookie: undefined, r: ok(f) }), "state_invalid"],
    ["no state param", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), state: null } }), "state_invalid"],
    ["a different state param (CSRF)", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), state: "attacker-state" } }), "state_invalid"],
    ["a forged cookie", () => ({ cookie: "v1:AAAA:BBBB:CCCC", r: { state: "x", provider: "gmail" as const, workspaceId: 1, userId: 7, now: 1 } }), "state_invalid"],
    ["an expired flow", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), now: 3_000_000 } }), "state_expired"],
    ["another user's session", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), userId: 8 } }), "state_mismatch"],
    ["another workspace", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), workspaceId: 2 } }), "state_mismatch"],
    ["the other provider's callback", (f: FlowState) => ({ cookie: sealFlowState(f), r: { ...ok(f), provider: "microsoft" as const } }), "state_mismatch"],
  ])("refuses %s", (_n, make, code) => {
    const f = flow();
    const { cookie, r } = make(f);
    expect(() => openFlowState(cookie, r)).toThrowError(expect.objectContaining({ code }));
    expect(() => openFlowState(cookie, r)).toThrow(FlowError);
  });

  it("a tampered ciphertext fails authentication instead of decoding to something else", () => {
    const f = flow();
    const parts = sealFlowState(f).split(":");
    parts[3] = Buffer.from("tampered").toString("base64");
    expect(() => openFlowState(parts.join(":"), ok(f))).toThrowError(expect.objectContaining({ code: "state_invalid" }));
  });
});
