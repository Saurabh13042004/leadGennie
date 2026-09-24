import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb, sql } from "../helpers/test-db";
import { splitStatements } from "../../scripts/lib/sql-split.mjs";
import { createWorkspace } from "../helpers/factories";
import { setSession } from "../helpers/session";
import { getSenderProfile, updateSenderPitch } from "@/lib/actions/profile";
import { dismissOnboarding, getOnboardingChecklist, getProfile, saveWorkspaceProfile } from "@/lib/actions/workspace-profile";
import { isIcpDefined, EMPTY_ICP, icpSchema, parseList, parseStoredIcp } from "@/lib/domain/workspace/icp";
import { buildChecklist } from "@/lib/domain/workspace/onboarding";

type W = Awaited<ReturnType<typeof createWorkspace>>;
let A: W;
let B: W;
const actAs = (w: W, role: "owner" | "admin" | "member" | "viewer" = "owner") =>
  setSession({ workspaceId: w.workspaceId, userId: w.user.id, email: w.user.email, role });
const one = async <T>(q: PromiseLike<T[]>) => (await q)[0];

beforeEach(async () => {
  await resetDb();
  A = await createWorkspace();
  B = await createWorkspace();
  actAs(A);
});

describe("positioning: dual-write, workspace-first reads (D-07)", () => {
  it("updateSenderPitch writes the workspace AND the legacy user column", async () => {
    await updateSenderPitch("  We sell shovels to gold miners.  ");
    expect(await one(sql`select positioning from workspaces where id = ${A.workspaceId}`)).toMatchObject({ positioning: "We sell shovels to gold miners." });
    expect(await one(sql`select pitch from users where id = ${A.user.id}`)).toMatchObject({ pitch: "We sell shovels to gold miners." });
    expect((await getSenderProfile()).pitch).toBe("We sell shovels to gold miners.");
    // …and never touches another workspace.
    expect(await one(sql`select positioning from workspaces where id = ${B.workspaceId}`)).toMatchObject({ positioning: null });
  });

  it("reads fall back to the user's legacy profile until the workspace has its own", async () => {
    await sql`update users set pitch = 'legacy pitch', company = 'Legacy Co' where id = ${A.user.id}`;
    expect(await getSenderProfile()).toEqual({ company: "Legacy Co", pitch: "legacy pitch" });
    await sql`update workspaces set positioning = 'workspace pitch', company_name = 'WS Co' where id = ${A.workspaceId}`;
    expect(await getSenderProfile()).toEqual({ company: "WS Co", pitch: "workspace pitch" });
  });

  it("migration 0007 seeds the workspace from the creator's profile, only filling blanks, and is re-runnable", async () => {
    await sql`update users set pitch = 'from user', company = 'User Co' where id = ${A.user.id}`;
    await sql`update workspaces set positioning = null, company_name = null where id = ${A.workspaceId}`;
    const migration = readFileSync(join(process.cwd(), "db/migrations/0007_workspace_positioning_icp.sql"), "utf-8");
    const update = splitStatements(migration).find((s: string) => /\nupdate workspaces /i.test(s))!;
    expect(update).toBeTruthy();
    await sql.query(update);
    expect(await one(sql`select positioning, company_name from workspaces where id = ${A.workspaceId}`)).toMatchObject({ positioning: "from user", company_name: "User Co" });
    await sql`update workspaces set positioning = 'edited since' where id = ${A.workspaceId}`;
    await sql.query(update);
    expect((await one(sql`select positioning from workspaces where id = ${A.workspaceId}`)).positioning).toBe("edited since");
  });

  it("a viewer cannot change positioning", async () => {
    actAs(A, "viewer");
    await expect(updateSenderPitch("nope")).rejects.toThrow(/role/);
  });
});

describe("saveWorkspaceProfile + ICP", () => {
  const valid = {
    positioning: "We help B2B SaaS teams book demos.",
    companyName: "Acme",
    icp: {
      version: 1 as const,
      industries: ["B2B SaaS"],
      employee_range: { min: 50, max: 500 },
      geographies: ["United States"],
      titles: ["VP Sales"],
      exclusions: { industries: [], domains: ["https://www.Competitor.com/x", "competitor.com"], titles: ["Intern"] },
    },
  };

  it("saves for admins, normalizes excluded domains, round-trips, and logs an activity", async () => {
    actAs(A, "admin");
    const res = await saveWorkspaceProfile(valid);
    expect(res.ok).toBe(true);
    const profile = await getProfile();
    expect(profile.positioning).toBe(valid.positioning);
    expect(profile.icp.exclusions.domains).toEqual(["competitor.com"]);
    expect(profile.icp.employee_range).toEqual({ min: 50, max: 500 });
    const act = await sql`select type from activities where workspace_id = ${A.workspaceId}`;
    expect(act.map((a) => a.type)).toContain("workspace.profile_updated");
  });

  it("is admin-only, and per workspace", async () => {
    actAs(A, "member");
    expect(await saveWorkspaceProfile(valid)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
    actAs(A, "admin");
    await saveWorkspaceProfile(valid);
    actAs(B, "owner");
    expect((await getProfile()).positioning).toBe("");
  });

  it("rejects bad input with field-level envelope errors", async () => {
    actAs(A, "admin");
    const reversed = await saveWorkspaceProfile({ ...valid, icp: { ...valid.icp, employee_range: { min: 500, max: 50 } } });
    expect(reversed).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    const badDomain = await saveWorkspaceProfile({ ...valid, icp: { ...valid.icp, exclusions: { ...valid.icp.exclusions, domains: ["not a domain"] } } });
    expect(badDomain).toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR", message: expect.stringContaining("not a domain") } });
    expect(await saveWorkspaceProfile({ ...valid, positioning: "x".repeat(2001) })).toMatchObject({ ok: false });
    expect(await saveWorkspaceProfile({ ...valid, icp: { ...valid.icp, surprise: 1 } })).toMatchObject({ ok: false });
  });

  it("ICP helpers: list parsing, definedness, and defensive reads of stored jsonb", () => {
    expect(parseList("a, B\nb;  c ,, a")).toEqual(["a", "B", "c"]);
    expect(isIcpDefined(EMPTY_ICP)).toBe(false);
    expect(isIcpDefined(icpSchema.parse({ titles: ["CEO"] }))).toBe(true);
    expect(isIcpDefined(icpSchema.parse({ employee_range: { min: 10, max: null } }))).toBe(true);
    expect(parseStoredIcp({ garbage: true })).toBeNull();
    expect(parseStoredIcp(null)).toBeNull();
  });
});

describe("onboarding checklist reflects real state", () => {
  async function step(id: string) {
    return (await getOnboardingChecklist()).steps.find((s) => s.id === id)!.done;
  }

  it("starts empty and each step flips only when the underlying data exists", async () => {
    const start = await getOnboardingChecklist();
    expect(start.steps.map((s) => s.done)).toEqual([false, false, false, false]);
    expect(start).toMatchObject({ completed: 0, total: 4, visible: true });

    await updateSenderPitch("We sell things.");
    expect(await step("positioning")).toBe(true);
    expect(await step("icp")).toBe(false);

    actAs(A, "admin");
    await saveWorkspaceProfile({ positioning: "We sell things.", companyName: "", icp: { ...EMPTY_ICP, titles: ["CEO"] } });
    expect(await step("icp")).toBe(true);

    // Email: a pending mailbox, or an active one on an UNverified domain, does not count.
    const domain = await one(sql`insert into domains (workspace_id, resend_domain_id, name, status) values (${A.workspaceId}, 'r1', 'a.com', 'pending') returning id`);
    const mailbox = await one(sql`insert into mailboxes (workspace_id, domain_id, email, status) values (${A.workspaceId}, ${domain.id}, 'me@a.com', 'active') returning id`);
    expect(await step("email")).toBe(false);
    await sql`update domains set status = 'verified' where id = ${domain.id}`;
    expect(await step("email")).toBe(true);
    await sql`update mailboxes set status = 'paused' where id = ${mailbox.id}`;
    expect(await step("email")).toBe(false);

    expect(await step("leads")).toBe(false);
    await sql`insert into leads (workspace_id, full_name) values (${A.workspaceId}, 'First Lead')`;
    expect(await step("leads")).toBe(true);
  });

  it("another workspace's data never completes a step", async () => {
    await sql`insert into leads (workspace_id, full_name) values (${B.workspaceId}, 'B lead')`;
    await sql`update workspaces set positioning = 'B pitch' where id = ${B.workspaceId}`;
    const c = await getOnboardingChecklist();
    expect(c.steps.every((s) => !s.done)).toBe(true);
  });

  it("dismissal persists; when everything is done the card hides on its own", async () => {
    expect((await getOnboardingChecklist()).visible).toBe(true);
    expect(await dismissOnboarding()).toEqual({ ok: true, data: null });
    const after = await getOnboardingChecklist();
    expect(after).toMatchObject({ dismissed: true, visible: false, completed: 0 });
    actAs(B);
    expect((await getOnboardingChecklist()).visible).toBe(true);

    const all = buildChecklist({ positioning: "x", icp: { ...EMPTY_ICP, titles: ["CEO"] }, hasActiveMailbox: true, hasLeads: true, dismissedAt: null });
    expect(all).toMatchObject({ allDone: true, visible: false, completed: 4 });
  });

  it("viewers can see progress but cannot dismiss", async () => {
    actAs(A, "viewer");
    expect((await getOnboardingChecklist()).total).toBe(4);
    expect(await dismissOnboarding()).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  });
});
