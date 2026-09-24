import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { resetDb, sql } from "../helpers/test-db";
import { createWorkspace } from "../helpers/factories";
import { DEMO_EMAIL, seedDemo } from "../../scripts/lib/seed-demo.mjs";

beforeEach(resetDb);

describe("demo seed (empty DB → migrate → seed)", () => {
  it("creates a demo user, an is_demo workspace with an owner membership, and sample leads", async () => {
    const r = await seedDemo(sql, { password: "pw-for-test" });
    const [ws] = await sql`select name, is_demo from workspaces where id = ${r.workspaceId}`;
    expect(ws).toMatchObject({ name: "Demo Workspace", is_demo: true });
    const [m] = await sql`select role from workspace_members where workspace_id = ${r.workspaceId}`;
    expect(m.role).toBe("owner");
    const leads = await sql`select email, source from leads where workspace_id = ${r.workspaceId}`;
    expect(leads).toHaveLength(5);
    expect(leads.every((l) => String(l.email).endsWith("@example.com") && l.source === "demo")).toBe(true);
    const [u] = await sql`select password_hash from users where email = ${DEMO_EMAIL}`;
    expect(bcrypt.compareSync("pw-for-test", u.password_hash as string)).toBe(true);
  });

  it("is idempotent and never hard-codes a password", async () => {
    const first = await seedDemo(sql);
    expect(first.generatedPassword).toMatch(/^[\w-]{12}$/);
    const second = await seedDemo(sql);
    expect(second.generatedPassword).toBeNull();
    expect(await sql`select 1 from users`).toHaveLength(1);
    expect(await sql`select 1 from leads`).toHaveLength(5);
    expect(await sql`select 1 from workspaces`).toHaveLength(1);
  });

  it("real workspaces are never flagged demo", async () => {
    const real = await createWorkspace();
    await seedDemo(sql);
    const [w] = await sql`select is_demo from workspaces where id = ${real.workspaceId}`;
    expect(w.is_demo).toBe(false);
  });
});
