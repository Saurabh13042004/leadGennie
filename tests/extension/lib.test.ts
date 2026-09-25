// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installChrome, removeChrome, type ChromeMock } from "../helpers/chrome-mock";
// The extension has no build step: these are the exact ES modules Chrome loads.
import { ApiError, apiFetch, publicFetch } from "../../chrome-extension/lib/api.js";
import { buildAuthorizeUrl, connect, describeDevice, disconnect, normalizeApiBase, parseAuthResponse, sha256Base64Url } from "../../chrome-extension/lib/auth.js";
import { clearSession, getSession, migrateLegacyConnection, setSession, takeSignedOutReason } from "../../chrome-extension/lib/storage.js";
import { editedFields, describeError, formFromCandidate, leadSubtitle, suggestionBasis, toLeadDraft, validateForm } from "../../chrome-extension/lib/capture-model.js";
import { collectPageFacts } from "../../chrome-extension/lib/page-facts.js";
import { challengeFromVerifier } from "@/lib/extension/tokens";

let chromeMock: ChromeMock;
const BASE = "http://localhost:3000";
const session = { apiBase: BASE, accessToken: "lgx_test", kind: "session", scopes: ["leads:read"], features: {}, user: null, workspace: null };

const jsonResponse = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) =>
  new Response(JSON.stringify(body), { status: init.status ?? 200, headers: { "content-type": "application/json", ...init.headers } });

beforeEach(() => {
  chromeMock = installChrome();
});
afterEach(() => {
  removeChrome();
  vi.unstubAllGlobals();
});

describe("PKCE in the extension matches the server's verifier check", () => {
  it("sha256Base64Url agrees with lib/extension/tokens.challengeFromVerifier for any verifier", async () => {
    for (const v of ["dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", "a".repeat(43), "Zz09-._~".repeat(8)]) {
      expect(await sha256Base64Url(v)).toBe(challengeFromVerifier(v));
    }
  });
});

describe("normalizeApiBase", () => {
  it("normalises to an origin; https required except for localhost", () => {
    expect(normalizeApiBase("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeApiBase("https://app.leadgennie.com/dashboard?x=1")).toBe("https://app.leadgennie.com");
    expect(normalizeApiBase(" http://127.0.0.1:3000 ")).toBe("http://127.0.0.1:3000");
  });
  it.each(["http://evil.example.com", "ftp://x.com", "javascript:alert(1)", "not a url", ""])("rejects %j", (bad) => {
    expect(() => normalizeApiBase(bad)).toThrow(ApiError);
  });
});

describe("the authorize URL and the redirect back", () => {
  it("carries only what the server needs — never a secret", () => {
    const url = new URL(buildAuthorizeUrl({ apiBase: BASE, redirectUri: "https://x.chromiumapp.org/connect", state: "st", challenge: "ch", device: "Chrome on macOS" }));
    expect(url.origin + url.pathname).toBe(`${BASE}/extension/connect`);
    expect([...url.searchParams.keys()].sort()).toEqual(["code_challenge", "device", "redirect_uri", "state"]);
  });

  it("parseAuthResponse returns the code, and refuses a denial, a wrong state, an error or a missing code", () => {
    expect(parseAuthResponse("https://x.chromiumapp.org/connect?code=abc&state=s1", "s1")).toBe("abc");
    expect(() => parseAuthResponse("https://x.chromiumapp.org/connect?error=access_denied&state=s1", "s1")).toThrow(/cancelled/);
    expect(() => parseAuthResponse("https://x.chromiumapp.org/connect?code=abc&state=OTHER", "s1")).toThrow(/did not match/);
    expect(() => parseAuthResponse("https://x.chromiumapp.org/connect?state=s1", "s1")).toThrow(/authorization code/);
    expect(() => parseAuthResponse("https://x.chromiumapp.org/connect?error=server_error&state=s1", "s1")).toThrow(/refused/);
    expect(() => parseAuthResponse("", "s1")).toThrow(ApiError);
  });

  it("describeDevice gives a recognisable label", () => {
    expect(describeDevice({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/124", userAgentData: { platform: "macOS" } } as never)).toBe("Chrome on macOS");
    expect(describeDevice({ userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/124 Edg/124" } as never)).toBe("Edge on Windows");
  });
});

describe("connect(): the whole flow, with the token kept out of the URL", () => {
  it("verifies state, exchanges the code with the PKCE verifier, and stores the session in LOCAL storage", async () => {
    let authorizeUrl = "";
    chromeMock.launchWebAuthFlow = async ({ url }) => {
      authorizeUrl = url;
      const u = new URL(url);
      return `${u.searchParams.get("redirect_uri")}?code=lgc_abc&state=${u.searchParams.get("state")}`;
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      // The server can verify this: the challenge in the authorize URL must be sha256(verifier).
      expect(await sha256Base64Url(body.code_verifier)).toBe(new URL(authorizeUrl).searchParams.get("code_challenge"));
      expect(body).toMatchObject({ code: "lgc_abc", redirect_uri: "https://testextensionidtestextensionid12.chromiumapp.org/connect" });
      return jsonResponse({
        ok: true, access_token: "lgx_secret", token_type: "Bearer", expires_at: "2027-01-01T00:00:00Z", scopes: ["leads:read", "leads:create"],
        user: { id: 1, name: "Sam", email: "sam@x.com", role: "member" }, workspace: { id: 7, name: "Acme WS" }, features: { linkedinAutomation: false, research: true },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const s = await connect({ apiBase: `${BASE}/` });
    expect(s).toMatchObject({ apiBase: BASE, accessToken: "lgx_secret", kind: "session", workspace: { name: "Acme WS" } });
    expect(authorizeUrl).not.toContain("lgx_secret");
    expect(JSON.stringify(chromeMock.local)).toContain("lgx_secret");
    expect(JSON.stringify(chromeMock.sync)).not.toContain("lgx_secret"); // never synced across the Google account
    expect((await getSession())?.accessToken).toBe("lgx_secret");
  });

  it("does not store anything when the person cancels, the state is tampered with, or the exchange fails", async () => {
    chromeMock.launchWebAuthFlow = async ({ url }) => `${new URL(url).searchParams.get("redirect_uri")}?error=access_denied&state=x`;
    await expect(connect({ apiBase: BASE })).rejects.toThrow(/cancelled/);

    chromeMock.launchWebAuthFlow = async ({ url }) => `${new URL(url).searchParams.get("redirect_uri")}?code=abc&state=WRONG`;
    await expect(connect({ apiBase: BASE })).rejects.toThrow(/did not match/);

    chromeMock.launchWebAuthFlow = async ({ url }) => `${new URL(url).searchParams.get("redirect_uri")}?code=abc&state=${new URL(url).searchParams.get("state")}`;
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, code: "BAD_REQUEST", error: "expired" }, { status: 400 })));
    await expect(connect({ apiBase: BASE })).rejects.toThrow(/expired/);
    expect(await getSession()).toBeNull();
  });

  it("maps a closed sign-in window to a friendly message", async () => {
    chromeMock.launchWebAuthFlow = async () => {
      throw new Error("The user did not approve access.");
    };
    await expect(connect({ apiBase: BASE })).rejects.toThrow(/cancelled/);
  });

  it("disconnect revokes on the server (best effort) and always forgets the token locally", async () => {
    await setSession(session);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, revoked: true }));
    vi.stubGlobal("fetch", fetchMock);
    await disconnect();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/api/extension/auth/revoke`, expect.objectContaining({ method: "POST" }));
    expect(await getSession()).toBeNull();

    await setSession(session);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    await disconnect();
    expect(await getSession()).toBeNull(); // offline: still signed out locally
  });
});

describe("apiFetch", () => {
  it("attaches the bearer token and returns the envelope", async () => {
    await setSession(session);
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true, leads: [], total: 0 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await apiFetch("/leads", { query: { q: "sarah", limit: 5, empty: "", nothing: null } });
    expect(r).toMatchObject({ ok: true, total: 0 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/extension/leads?q=sarah&limit=5`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer lgx_test");
  });

  it("a 401 forgets the session, remembers why, and tells the UI to sign in again", async () => {
    await setSession(session);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, code: "UNAUTHENTICATED", error: "Unauthorized" }, { status: 401 })));
    await expect(apiFetch("/me")).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(await getSession()).toBeNull();
    expect(await takeSignedOutReason()).toBe("expired");
    expect(await takeSignedOutReason()).toBeNull(); // shown once
  });

  it("turns server errors into stable codes, honouring Retry-After", async () => {
    await setSession(session);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, code: "RATE_LIMITED", error: "Slow down" }, { status: 429, headers: { "retry-after": "12" } })));
    await expect(apiFetch("/leads")).rejects.toMatchObject({ code: "RATE_LIMITED", status: 429, retryAfter: 12 });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, code: "FORBIDDEN", error: "Your role (viewer) can't do that." }, { status: 403 })));
    await expect(apiFetch("/leads")).rejects.toMatchObject({ code: "FORBIDDEN", message: "Your role (viewer) can't do that." });
    expect(await getSession()).not.toBeNull(); // a 403 is not a sign-out

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>bad gateway</html>", { status: 502 })));
    await expect(apiFetch("/leads")).rejects.toMatchObject({ code: "SERVER", status: 502 });
  });

  it("a network failure is a friendly NETWORK error that names the server; no session is NOT_CONNECTED", async () => {
    await setSession(session);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(apiFetch("/leads")).rejects.toMatchObject({ code: "NETWORK", message: expect.stringContaining(BASE) });
    await clearSession();
    await expect(apiFetch("/leads")).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });

  it("publicFetch (the code exchange) needs no session and surfaces server errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: false, code: "BAD_REQUEST", error: "This connection request expired" }, { status: 400 })));
    await expect(publicFetch(BASE, "/auth/token", {})).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("legacy token migration", () => {
  it("moves a pre-connect-flow token from synced to local storage and keeps it working as a 'legacy' session", async () => {
    chromeMock.sync.connection = { apiBase: "https://old.example.com", apiToken: "lg_oldtoken" };
    expect(await migrateLegacyConnection()).toBe(true);
    expect(chromeMock.sync.connection).toBeUndefined(); // no longer synced
    expect(await getSession()).toMatchObject({ apiBase: "https://old.example.com", accessToken: "lg_oldtoken", kind: "legacy", scopes: ["leads:read", "leads:create"] });
    expect(await migrateLegacyConnection()).toBe(false); // idempotent
  });

  it("never overwrites a real session with a stale legacy one", async () => {
    await setSession(session);
    chromeMock.sync.connection = { apiBase: "https://old.example.com", apiToken: "lg_oldtoken" };
    await migrateLegacyConnection();
    expect((await getSession())?.accessToken).toBe("lgx_test");
  });
});

describe("capture model (shared by the popup and the on-page widget)", () => {
  const candidate = { fields: { fullName: "Sarah Chen", jobTitle: "VP Sales", company: "Acme", companyDomain: "acme.com" }, sources: {}, confidence: "high", warnings: [], usedLlm: false, pageKind: "web", sourceUrl: "https://acme.com/team" };

  it("builds the form from the server's candidate and diffs what the person changed", () => {
    const original = formFromCandidate(candidate);
    expect(original).toMatchObject({ full_name: "Sarah Chen", job_title: "VP Sales", company: "Acme", company_domain: "acme.com", email: "" });
    const edited = { ...original, company: "Acme Inc", email: "sarah@acme.com" };
    expect(editedFields(original, edited)).toEqual(["company", "email"]);
    expect(editedFields(original, { ...original, job_title: "  VP Sales " })).toEqual([]); // whitespace is not an edit
  });

  it("validates only what a person can fix in the card", () => {
    expect(validateForm({ full_name: "  ", email: "" })).toEqual({ full_name: "Enter a name." });
    expect(validateForm({ full_name: "Sarah", email: "nope" })).toHaveProperty("email");
    expect(validateForm({ full_name: "Sarah", email: "sarah@acme.com" })).toEqual({});
  });

  it("the save payload nulls blanks, trims, records the page it came from and which fields were edited", () => {
    const original = formFromCandidate(candidate);
    const draft = toLeadDraft({ ...original, full_name: " Sarah Chen ", email: "", company: "Acme Inc" }, { sourceUrl: "https://acme.com/team", original });
    expect(draft).toMatchObject({ full_name: "Sarah Chen", email: null, linkedin_url: null, company: "Acme Inc", source_url: "https://acme.com/team", edited_fields: ["company"] });
  });

  it("flags a chosen suggestion as a guess, but only when there is an email to flag", () => {
    const original = formFromCandidate(candidate);
    const withEmail = { ...original, email: "sarah.chen@acme.com" };
    expect(toLeadDraft(withEmail, { sourceUrl: "u", original, emailGuessed: true })).toMatchObject({ email: "sarah.chen@acme.com", email_guessed: true, edited_fields: ["email"] });
    expect(toLeadDraft(withEmail, { sourceUrl: "u", original, emailGuessed: false }).email_guessed).toBe(false);
    expect(toLeadDraft({ ...original, email: "" }, { sourceUrl: "u", original, emailGuessed: true }).email_guessed).toBe(false);
  });

  it("explains where the suggested format came from — your own emails, or just common formats", () => {
    expect(suggestionBasis([{ email: "a@x.com", basis: "existing", matches: 2 }], "x.com")).toMatch(/2 emails you already have at x\.com/);
    expect(suggestionBasis([{ email: "a@x.com", basis: "existing", matches: 1 }], "x.com")).toMatch(/1 email you already have/);
    expect(suggestionBasis([{ email: "a@x.com", basis: "common" }], "x.com")).toMatch(/nobody has confirmed/);
  });

  it("describes errors in plain language and says whether retrying makes sense", () => {
    expect(describeError({ code: "UNAUTHENTICATED" })).toMatchObject({ action: "connect", retryable: false });
    expect(describeError({ code: "RATE_LIMITED", retryAfter: 9 })).toMatchObject({ retryable: true, message: expect.stringContaining("9s") });
    expect(describeError({ code: "FORBIDDEN", message: "Your role (viewer) can't do that." })).toMatchObject({ retryable: false, message: "Your role (viewer) can't do that." });
    expect(describeError({ code: "NETWORK", message: "x" }).retryable).toBe(true);
    expect(leadSubtitle({ jobTitle: "VP Sales", company: "Acme", companyDomain: "acme.com" })).toBe("VP Sales · Acme · acme.com");
  });
});

describe("collectPageFacts", () => {
  const el = (over: Record<string, unknown>) => ({ getAttribute: () => null, textContent: "", innerText: "", ...over });
  const fakeDoc = (parts: { text?: string; h1?: string[]; ld?: string[]; mailto?: string[]; meta?: Record<string, string>; title?: string }) => ({
    title: parts.title ?? "",
    body: el({ innerText: parts.text ?? "" }),
    documentElement: el({}),
    querySelector: (sel: string) => {
      if (sel === "main") return null;
      const m = /meta\[(?:property|name)="([^"]+)"\]/.exec(sel);
      if (m && parts.meta?.[m[1]]) return el({ getAttribute: () => parts.meta![m[1]] });
      if (sel === 'link[rel="canonical"]' && parts.meta?.canonical) return el({ getAttribute: () => parts.meta!.canonical });
      return null;
    },
    querySelectorAll: (sel: string) => {
      if (sel === "h1") return (parts.h1 ?? []).map((t) => el({ innerText: t }));
      if (sel.startsWith("script")) return (parts.ld ?? []).map((t) => el({ textContent: t }));
      if (sel.startsWith("a[href")) return (parts.mailto ?? []).map((a) => el({ getAttribute: () => `mailto:${a}?subject=Hi` }));
      return [];
    },
  });
  const win = (href: string, selection = "") => ({ location: { href }, getSelection: () => selection });

  it("collects text, headings, JSON-LD, mailto addresses, site name, canonical URL and the selection", () => {
    const f = collectPageFacts(12000, fakeDoc({
      title: "Sarah Chen | Acme", text: "Sarah Chen\n\n\n\nVP Sales", h1: ["Sarah Chen"], ld: ['{"@type":"Person","name":"Sarah Chen"}', "{ not json"],
      mailto: ["sarah%40acme.com", "sarah%40acme.com"], meta: { "og:site_name": "Acme", canonical: "https://acme.com/team/sarah" },
    }) as never, win("https://acme.com/team/sarah?utm=x", " Sarah Chen ") as never);
    expect(f).toMatchObject({
      url: "https://acme.com/team/sarah?utm=x", title: "Sarah Chen | Acme", text: "Sarah Chen\n\nVP Sales", headings: ["Sarah Chen"],
      jsonld: [{ "@type": "Person", name: "Sarah Chen" }], emails: ["sarah@acme.com"], siteName: "Acme", canonicalUrl: "https://acme.com/team/sarah", selection: "Sarah Chen",
    });
  });

  it("collects only 'Current company' labels as hints (short, few) — nothing else from aria-labels", () => {
    const doc = fakeDoc({ text: "x" }) as unknown as { querySelectorAll: (s: string) => unknown[] };
    const orig = doc.querySelectorAll;
    doc.querySelectorAll = (sel: string) =>
      sel.startsWith("[aria-label*") ? ["Current company: Acme. Click to skip to experience card", "Company page", "Current company: Acme. Click to skip to experience card", "Notifications"].map((l) => el({ getAttribute: () => l })) : orig(sel);
    const f = collectPageFacts(12000, doc as never, win("https://www.linkedin.com/in/x") as never);
    expect(f.hints).toEqual(["Current company: Acme. Click to skip to experience card"]);
  });

  it("caps the text it sends and omits empty optional fields", () => {
    const f = collectPageFacts(50, fakeDoc({ text: "x".repeat(500) }) as never, win("https://a.com") as never);
    expect(f.text).toHaveLength(50);
    expect(f).not.toHaveProperty("selection");
    expect(f).not.toHaveProperty("siteName");
  });
});
