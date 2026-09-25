import { describe, expect, it } from "vitest";
import { welcomeEmail } from "@/lib/email/templates/welcome";
import { inviteEmail } from "@/lib/email/templates/invite";
import { esc } from "@/lib/email/templates/layout";
import { appBaseUrl } from "@/lib/campaigns/render";

const BASE = "https://app.leadgennie.test";

describe("welcome email", () => {
  const m = welcomeEmail({ name: "Hari Owner", baseUrl: BASE });
  it("greets by first name and points at the workspace", () => {
    expect(m.subject).toBe("Welcome to LeadGennie, Hari");
    expect(m.html).toContain("Welcome, Hari.");
    expect(m.html).toContain(`href="${BASE}/dashboard"`);
    expect(m.text).toContain(`${BASE}/dashboard`);
  });
  it("embeds a product screenshot by absolute URL, with alt text", () => {
    expect(m.html).toMatch(new RegExp(`<img src="${BASE}/email/welcome-campaign\\.png" alt="[^"]+"`));
  });
  it("is themed like the dashboard (neutral-900 primary button, white card) and makes no numeric claims", () => {
    expect(m.html).toContain("background:#171717");
    expect(m.html).toContain("border-radius:16px");
    expect(m.html.replace(/<[^>]+>/g, " ")).not.toMatch(/\d+\s?%|\b\d{2,}\b\s+(leads|emails|meetings)/i);
  });
  it("copes with a blank or one-word name and escapes markup in it", () => {
    expect(welcomeEmail({ name: "   ", baseUrl: BASE }).subject).toBe("Welcome to LeadGennie, there");
    const evil = welcomeEmail({ name: "<script>alert(1)</script>", baseUrl: BASE });
    expect(evil.html).not.toContain("<script>");
    expect(evil.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
  it("has a plain-text alternative with no HTML", () => {
    expect(m.text).not.toMatch(/<[a-z]/i);
    expect(m.text.length).toBeGreaterThan(100);
  });
});

describe("invite email", () => {
  const base = { inviterName: "Sam Lee", workspaceName: "Leadgennie Solutions", role: "member" as const, inviteeEmail: "new.person+tag@corp.example", baseUrl: BASE };
  it("a new person is sent to sign up with the invited address pre-filled", () => {
    const m = inviteEmail({ ...base, existingAccount: false });
    expect(m.subject).toBe("Sam Lee invited you to Leadgennie Solutions on LeadGennie");
    expect(m.html).toContain(`href="${BASE}/signup?email=new.person%2Btag%40corp.example"`);
    expect(m.html).toContain("Accept invitation");
    expect(m.text).toContain(`${BASE}/signup?email=new.person%2Btag%40corp.example`);
  });
  it("someone who already has an account is sent to sign in", () => {
    const m = inviteEmail({ ...base, existingAccount: true });
    expect(m.html).toContain(`href="${BASE}/login"`);
    expect(m.html).toContain("Open LeadGennie");
    expect(m.html).not.toContain("/signup");
  });
  it("describes the role in plain words, with the right article", () => {
    expect(inviteEmail({ ...base, role: "admin", existingAccount: false }).text).toMatch(/as an admin\./);
    expect(inviteEmail({ ...base, role: "viewer", existingAccount: false }).text).toMatch(/as a viewer\.[\s\S]*read-only/);
  });
  it("escapes the workspace and inviter names everywhere they appear", () => {
    const m = inviteEmail({ ...base, workspaceName: `Evil "Corp" <b>`, inviterName: "<i>Mallory</i>", existingAccount: false });
    expect(m.html).not.toContain("<b>");
    expect(m.html).not.toContain("<i>Mallory");
    expect(m.html).toContain("Evil &quot;Corp&quot; &lt;b&gt;");
  });
  it("falls back to a generic inviter when the name is missing", () => {
    expect(inviteEmail({ ...base, inviterName: " ", existingAccount: false }).subject).toMatch(/^A teammate invited you/);
  });
});

describe("esc", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(esc(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});

describe("appBaseUrl", () => {
  it("has no trailing slash, so links never contain '//'", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    try {
      for (const v of ["https://leadgennie.com/", "https://leadgennie.com", " https://leadgennie.com// "]) {
        process.env.NEXT_PUBLIC_APP_URL = v;
        expect(appBaseUrl()).toBe("https://leadgennie.com");
      }
      expect(welcomeEmail({ name: "A", baseUrl: appBaseUrl() }).html).toContain('href="https://leadgennie.com/dashboard"');
    } finally {
      if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});
