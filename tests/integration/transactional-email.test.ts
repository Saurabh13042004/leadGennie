import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { createUser, createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { FakeMailProvider } from "@/lib/email/fake-provider";
import { MailProviderError, setMailProvider } from "@/lib/email/provider";
import { sendSystemEmail } from "@/lib/email/system-mail";
import { inviteMember } from "@/lib/actions/workspace";
import { POST as register } from "@/app/api/register/route";

let mail: FakeMailProvider;
beforeEach(async () => {
  await resetDb();
  mail = new FakeMailProvider();
  setMailProvider(mail);
  process.env.RESEND_FROM_EMAIL = "LeadGennie <hello@leadgennie.test>";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.leadgennie.test";
});
afterEach(() => {
  setMailProvider(null);
  setSession(null);
  delete process.env.RESEND_FROM_EMAIL;
  delete process.env.NEXT_PUBLIC_APP_URL;
});

const signup = (over: Record<string, unknown> = {}) =>
  register(new Request("http://localhost/api/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Hari Owner", email: "hari@corp.example", password: "correct-horse-1", company: "Corp", ...over }),
  }), undefined);

async function admin(role: "owner" | "admin" | "member" = "owner") {
  const { workspaceId, user } = await createWorkspace({ name: "Acme Sales" });
  await sql`update users set name = 'Sam Lee' where id = ${user.id}`;
  setSession({ workspaceId, userId: user.id, email: user.email, role });
  return { workspaceId, user };
}

describe("welcome email on sign-up", () => {
  it("sends one themed welcome email to the new address, from the configured sender", async () => {
    const res = await signup();
    expect(res.status).toBe(200);
    expect(mail.delivered).toHaveLength(1);
    const m = mail.delivered[0];
    expect(m).toMatchObject({ to: "hari@corp.example", from: "LeadGennie <hello@leadgennie.test>", subject: "Welcome to LeadGennie, Hari" });
    expect(m.html).toContain("https://app.leadgennie.test/dashboard");
    expect(m.html).toContain("https://app.leadgennie.test/email/welcome-campaign.png");
    expect(m.text).toContain("Welcome to LeadGennie, Hari");
    expect(m.tags).toEqual([{ name: "kind", value: "welcome" }]);
  });

  it("sign-up still succeeds when mail is down or unconfigured — and says nothing false", async () => {
    mail.failNext(new MailProviderError("Resend is down", "retryable", "internal_server_error"), 1);
    expect((await signup({ email: "a@corp.example" })).status).toBe(200);
    mail.configured = false;
    expect((await signup({ email: "b@corp.example" })).status).toBe(200);
    delete process.env.RESEND_FROM_EMAIL;
    mail.configured = true;
    expect((await signup({ email: "c@corp.example" })).status).toBe(200);
    expect(mail.delivered).toHaveLength(0);
    expect((await sql`select 1 from users where email like '%@corp.example'`)).toHaveLength(3);
  });

  it("a rejected duplicate registration sends nothing", async () => {
    await signup();
    mail.delivered.length = 0;
    expect((await signup()).status).toBe(409);
    expect(mail.delivered).toHaveLength(0);
  });

  it("an invited person who signs up joins the workspace AND gets the welcome email", async () => {
    const { workspaceId } = await admin();
    await inviteMember("hari@corp.example", "member");
    mail.delivered.length = 0;
    await signup();
    expect(mail.delivered.map((d) => d.subject)).toEqual(["Welcome to LeadGennie, Hari"]);
    const rows = await sql`select wm.status, wm.role from workspace_members wm join users u on u.id = wm.user_id where wm.workspace_id = ${workspaceId} and u.email = 'hari@corp.example'`;
    expect(rows).toEqual([{ status: "active", role: "member" }]);
  });
});

describe("invite email", () => {
  it("emails a new person a sign-up link for their own address, naming the inviter, workspace and role", async () => {
    await admin();
    expect(await inviteMember("New.Person@Corp.example", "admin")).toEqual({ emailed: true });
    expect(mail.delivered).toHaveLength(1);
    const m = mail.delivered[0];
    expect(m.to).toBe("new.person@corp.example");
    expect(m.subject).toBe("Sam Lee invited you to Acme Sales on LeadGennie");
    expect(m.html).toContain("https://app.leadgennie.test/signup?email=new.person%40corp.example");
    expect(m.text).toMatch(/as an admin/);
  });

  it("someone who already has an account is added and emailed a sign-in link", async () => {
    const { workspaceId } = await admin();
    const existing = await createUser({ email: "old@corp.example" });
    expect(await inviteMember("old@corp.example", "viewer")).toEqual({ emailed: true });
    expect(mail.delivered[0].html).toContain("https://app.leadgennie.test/login");
    const rows = await sql`select status from workspace_members where workspace_id = ${workspaceId} and user_id = ${existing.id}`;
    expect(rows).toEqual([{ status: "active" }]);
  });

  it("the invite is saved even if the email can't be sent, and the caller is told", async () => {
    const { workspaceId } = await admin();
    mail.failNext(new MailProviderError("nope", "permanent", "validation_error"), 1);
    expect(await inviteMember("x@corp.example", "member")).toEqual({ emailed: false });
    expect((await sql`select 1 from workspace_members where workspace_id = ${workspaceId} and invited_email = 'x@corp.example' and status = 'invited'`)).toHaveLength(1);
  });

  it("nothing is sent for a rejected invite (duplicate, bad address, or not an admin)", async () => {
    await admin();
    await inviteMember("dup@corp.example", "member");
    mail.delivered.length = 0;
    mail.requests.length = 0;
    await expect(inviteMember("dup@corp.example", "member")).rejects.toThrow(/already/);
    await expect(inviteMember("not-an-email", "member")).rejects.toThrow(/valid email/);
    await expect(inviteMember("z@corp.example", "owner" as never)).rejects.toThrow(/Invalid role/);
    await admin("member");
    await expect(inviteMember("y@corp.example", "member")).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mail.requests).toHaveLength(0);
  });
});

describe("sendSystemEmail", () => {
  it("reports why it did not send, and never throws", async () => {
    mail.configured = false;
    expect(await sendSystemEmail({ to: "a@b.example", kind: "t", subject: "s", html: "<p>x</p>", text: "x" })).toEqual({ sent: false, reason: "not_configured" });
    mail.configured = true;
    mail.failNext(new MailProviderError("boom", "auth", "invalid_api_key"), 1);
    expect(await sendSystemEmail({ to: "a@b.example", kind: "t", subject: "s", html: "<p>x</p>", text: "x" })).toEqual({ sent: false, reason: "failed" });
    expect(await sendSystemEmail({ to: "a@b.example", kind: "t", subject: "s", html: "<p>x</p>", text: "x" })).toMatchObject({ sent: true });
  });
  it("every call has its own idempotency key (two invites to the same person are two emails)", async () => {
    await sendSystemEmail({ to: "a@b.example", kind: "t", subject: "s", html: "x", text: "x" });
    await sendSystemEmail({ to: "a@b.example", kind: "t", subject: "s", html: "x", text: "x" });
    expect(mail.delivered).toHaveLength(2);
  });
});
