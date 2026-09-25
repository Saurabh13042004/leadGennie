import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { createOAuthMailbox, installMailboxFakes } from "../helpers/mailboxes";
import { setSession } from "../helpers/session";
import { GET as connectGet } from "@/app/api/mailboxes/[provider]/connect/route";
import { GET as callbackGet } from "@/app/api/mailboxes/[provider]/callback/route";
import { FLOW_COOKIE } from "@/lib/domain/mailboxes/oauth/flow-state";

const { oauth } = installMailboxFakes();
const BASE = "http://localhost:3000";

let A: Awaited<ReturnType<typeof createWorkspace>>;
beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  as("owner");
});
const as = (role: "owner" | "admin" | "member" | "viewer") => setSession({ workspaceId: A.workspaceId, userId: A.user.id, email: A.user.email, role });
const ctx = (provider: string) => ({ params: Promise.resolve({ provider }) });
const req = (path: string, cookie?: string) => new NextRequest(`${BASE}${path}`, { headers: cookie ? { cookie: `${FLOW_COOKIE}=${cookie}` } : {} });
const cookieOf = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith(`${FLOW_COOKIE}=`)) ?? "";
const valueOf = (setCookie: string) => setCookie.split(";")[0].split("=").slice(1).join("=");
const where = (res: Response) => new URL(res.headers.get("location")!);

describe("GET /api/mailboxes/:provider/connect", () => {
  it("redirects to the provider's consent page and sets a sealed, httpOnly, same-site state cookie", async () => {
    const res = await connectGet(req("/api/mailboxes/google/connect"), ctx("google"));
    expect(res.status).toBe(307);
    expect(where(res).origin).toBe("https://idp.test");
    const state = where(res).searchParams.get("state")!;
    expect(state.length).toBeGreaterThan(20);
    const set = cookieOf(res);
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(set).toMatch(/Max-Age=600/);
    expect(set).not.toContain(state); // the cookie holds the sealed flow, not the raw nonce
    expect(oauth.gmail.authorizeCalls[0].redirectUri).toBe("http://localhost:3000/api/mailboxes/google/callback");
  });

  it("supports Microsoft and a reconnect target", async () => {
    const mb = await createOAuthMailbox(A.workspaceId, { provider: "microsoft", email: "ada@contoso.com", status: "reconnect_required" });
    const res = await connectGet(req(`/api/mailboxes/microsoft/connect?mailboxId=${mb.id}`), ctx("microsoft"));
    expect(where(res).origin).toBe("https://idp.test");
    expect(oauth.microsoft.authorizeCalls[0].loginHint).toBe("ada@contoso.com");
  });

  it("asks for inbox access only when explicitly requested", async () => {
    await connectGet(req("/api/mailboxes/google/connect"), ctx("google"));
    await connectGet(req("/api/mailboxes/google/connect?inbox=1"), ctx("google"));
    expect(oauth.gmail.authorizeCalls[0].scopes.some((s) => s.includes("readonly"))).toBe(false);
    expect(oauth.gmail.authorizeCalls[1].scopes.some((s) => s.includes("readonly"))).toBe(true);
  });

  it("unknown provider → 404; bad mailbox id → back to the page with a message; not signed in → sign-in page; member → forbidden", async () => {
    expect((await connectGet(req("/api/mailboxes/yahoo/connect"), ctx("yahoo"))).status).toBe(404);
    expect(where(await connectGet(req("/api/mailboxes/google/connect?mailboxId=abc"), ctx("google"))).searchParams.get("mailbox_error")).toBe("target_missing");
    setSession(null);
    expect(where(await connectGet(req("/api/mailboxes/google/connect"), ctx("google"))).pathname).toBe("/login");
    as("member");
    const res = await connectGet(req("/api/mailboxes/google/connect"), ctx("google"));
    expect(where(res).pathname).toBe("/dashboard/deliverability");
    expect(where(res).searchParams.get("mailbox_error")).toBe("forbidden");
    expect(cookieOf(res)).toBe("");
  });

  it("a server without credentials says so instead of sending the user to the provider", async () => {
    oauth.gmail.configured = false;
    const res = await connectGet(req("/api/mailboxes/google/connect"), ctx("google"));
    expect(where(res).pathname).toBe("/dashboard/deliverability");
    expect(where(res).searchParams.get("mailbox_error")).toBe("not_configured");
  });
});

describe("GET /api/mailboxes/:provider/callback", () => {
  async function startFlow(provider = "google") {
    const res = await connectGet(req(`/api/mailboxes/${provider}/connect`), ctx(provider));
    return { state: where(res).searchParams.get("state")!, cookie: valueOf(cookieOf(res)) };
  }

  it("completes the connection, lands on the mailboxes page, and clears the flow cookie", async () => {
    const { state, cookie } = await startFlow();
    const res = await callbackGet(req(`/api/mailboxes/google/callback?code=abc&state=${state}`, cookie), ctx("google"));
    const to = where(res);
    expect(to.pathname).toBe("/dashboard/deliverability");
    expect(to.searchParams.get("mailbox_connected")).toBe("google");
    expect(to.searchParams.get("outcome")).toBe("connected");
    expect(cookieOf(res)).toMatch(/Max-Age=0/);
    expect((await sql`select provider, status from mailboxes where workspace_id = ${A.workspaceId}`)).toEqual([{ provider: "gmail", status: "active" }]);
    // nothing sensitive in the URL
    expect(res.headers.get("location")).not.toMatch(/abc|access-1|refresh-1|verifier/);
  });

  it("a callback without the cookie, or with a different state (CSRF), connects nothing", async () => {
    const { state, cookie } = await startFlow();
    const noCookie = await callbackGet(req(`/api/mailboxes/google/callback?code=abc&state=${state}`), ctx("google"));
    expect(where(noCookie).searchParams.get("mailbox_error")).toBe("state_invalid");
    const wrongState = await callbackGet(req("/api/mailboxes/google/callback?code=abc&state=forged", cookie), ctx("google"));
    expect(where(wrongState).searchParams.get("mailbox_error")).toBe("state_invalid");
    expect(cookieOf(wrongState)).toMatch(/Max-Age=0/);
    expect(await sql`select id from mailboxes`).toHaveLength(0);
    expect(oauth.gmail.exchangeCalls).toHaveLength(0);
  });

  it("the flow started by one user can't be finished by another (session fixation)", async () => {
    const { state, cookie } = await startFlow();
    const other = await createWorkspace();
    setSession({ workspaceId: other.workspaceId, userId: other.user.id, email: other.user.email, role: "owner" });
    const res = await callbackGet(req(`/api/mailboxes/google/callback?code=abc&state=${state}`, cookie), ctx("google"));
    expect(where(res).searchParams.get("mailbox_error")).toBe("state_mismatch");
    expect(await sql`select id from mailboxes`).toHaveLength(0);
  });

  it("the user cancelling on the consent screen", async () => {
    const { state, cookie } = await startFlow();
    const res = await callbackGet(req(`/api/mailboxes/google/callback?error=access_denied&state=${state}`, cookie), ctx("google"));
    expect(where(res).searchParams.get("mailbox_error")).toBe("access_denied");
    expect(where(res).searchParams.get("provider")).toBe("google");
  });

  it("not signed in → sign-in page; member → forbidden; unknown provider → 404", async () => {
    setSession(null);
    expect(where(await callbackGet(req("/api/mailboxes/google/callback?code=a&state=b"), ctx("google"))).pathname).toBe("/login");
    as("member");
    expect(where(await callbackGet(req("/api/mailboxes/google/callback?code=a&state=b"), ctx("google"))).searchParams.get("mailbox_error")).toBe("forbidden");
    expect((await callbackGet(req("/api/mailboxes/aol/callback"), ctx("aol"))).status).toBe(404);
  });
});
