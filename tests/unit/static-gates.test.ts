import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const scripts = join(process.cwd(), "scripts/checks");
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

function run(script: string, files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), "gate-"));
  dirs.push(cwd);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(cwd, path, ".."), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  try {
    const out = execFileSync("node", [join(scripts, script)], { cwd, encoding: "utf-8", stdio: "pipe" });
    return { code: 0, out };
  } catch (e) {
    const err = e as { status: number; stderr: string };
    return { code: err.status, out: err.stderr };
  }
}

describe("no-fake-metrics gate", () => {
  const gate = "no-fake-metrics.mjs";

  it.each([
    ["metric literal", 'components/A.tsx', 'const t = "+31% Avg Reply Rate";'],
    ["score literal", "components/A.tsx", 'const t = "Lead scored 98/100";'],
    ["hash-derived number", "components/A.tsx", "const r = hashRate(name);"],
    ["Math.random in UI", "app/x/page.tsx", "const h = Math.random() * 60;"],
    ["hardcoded key", "components/A.tsx", 'const k = "pk_JjnhOWGpTn6ebgzkcOylJg";'],
    ["third-party logo marquee", "components/A.tsx", 'const u = `https://img.logo.dev/stripe.com`;'],
  ])("fails on %s", (_name, path, content) => {
    const r = run(gate, { [path]: content });
    expect(r.code).toBe(1);
    expect(r.out).toContain("violation"); // a real finding, not a crash
  });

  it("passes clean code, and honours the demo-data-ok pragma", () => {
    expect(run(gate, { "components/A.tsx": "export const A = () => null;" }).code).toBe(0);
    expect(run(gate, { "components/A.tsx": '// demo-data-ok\nconst t = "24% reply rate";' }).code).toBe(0);
  });

  it("allows Math.random only in the allow-listed decorative file", () => {
    expect(run(gate, { "components/BackgroundEffects.tsx": "const x = Math.random();" }).code).toBe(0);
  });
});

describe("workspace-scoped-sql gate", () => {
  const gate = "workspace-scoped-sql.mjs";
  const wrap = (sql: string) => "export const f = () => sql`" + sql + "`;";

  it("fails on an UPDATE/DELETE of a workspace table without workspace_id", () => {
    for (const sql of ["update leads set full_name = ${n} where id = ${id}", "delete from tasks where id = ${id}"]) {
      const r = run(gate, { "lib/a.ts": wrap(sql) });
      expect(r.code).toBe(1);
      expect(r.out).toContain("unscoped UPDATE/DELETE");
    }
  });

  it("understands SQL assembled from nested template literals", () => {
    const scoped = "const q = `update leads l set ${cols.map((c) => `${c} = v.${c}`).join(', ')} where l.id = v.id and l.workspace_id = $1`;";
    const unscoped = "const q = `update leads l set ${cols.map((c) => `${c} = v.${c}`).join(', ')} where l.id = v.id`;";
    expect(run(gate, { "lib/a.ts": scoped }).code).toBe(0);
    const bad = run(gate, { "lib/a.ts": unscoped });
    expect(bad.code).toBe(1);
    expect(bad.out).toContain("unscoped UPDATE/DELETE");
  });

  it("passes when scoped, on non-workspace tables, or with an explicit reason", () => {
    expect(run(gate, { "lib/a.ts": wrap("update leads set x = 1 where id = ${id} and workspace_id = ${w}") }).code).toBe(0);
    expect(run(gate, { "lib/a.ts": wrap("update users set name = ${n} where id = ${id}") }).code).toBe(0);
    expect(run(gate, { "lib/a.ts": wrap("-- workspace-scope-ok: scoped via parent\n update leads set x = 1 where id = ${id}") }).code).toBe(0);
  });
});
