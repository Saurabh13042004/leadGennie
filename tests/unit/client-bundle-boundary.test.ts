// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A "use client" component is shipped to the browser along with everything it imports. If that graph reaches
 * lib/db/client.ts it throws "DATABASE_URL is not set" the moment the page loads — and nothing else (typecheck, lint,
 * tests, the build itself) notices. This is exactly how the extension consent page broke. So: walk every client
 * component's imports and refuse any path to the database client. `import type` is erased and does not count, and a
 * "use server" module is a network boundary (the client only gets a reference to it), so the walk stops there.
 */
const ROOT = resolve(__dirname, "../..");
const FORBIDDEN = "lib/db/client.ts";

function walkDir(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules" || n.startsWith(".")) return [];
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walkDir(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, spec.slice(2)) : spec.startsWith(".") ? resolve(dirname(from), spec) : null;
  if (!base) return null; // a package
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c) && statSync(c).isFile()) return c;
  }
  return null;
}

const firstLines = (src: string) => src.slice(0, 200);
const isClient = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use client["']/.test(firstLines(src));
const isServerAction = (src: string) => /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/\s*)*["']use server["']/.test(firstLines(src));

function importsOf(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|\n)\s*(import|export)\s+(type\s+)?(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g)) {
    if (m[2]) continue; // import type / export type
    out.push(m[3]);
  }
  for (const m of src.matchAll(/(?:^|\n)\s*import\s+["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}

function pathToForbidden(entry: string): string[] | null {
  const seen = new Set<string>();
  const dfs = (file: string, trail: string[]): string[] | null => {
    const rel = relative(ROOT, file);
    if (rel === FORBIDDEN) return [...trail, rel];
    if (seen.has(file)) return null;
    seen.add(file);
    const src = readFileSync(file, "utf8");
    if (file !== entry && isServerAction(src)) return null; // network boundary
    for (const spec of importsOf(src)) {
      const target = resolveImport(file, spec);
      if (!target) continue;
      const hit = dfs(target, [...trail, rel]);
      if (hit) return hit;
    }
    return null;
  };
  return dfs(entry, []);
}

describe("client bundle boundary", () => {
  const clients = [...walkDir(join(ROOT, "components")), ...walkDir(join(ROOT, "app"))].filter((f) => isClient(readFileSync(f, "utf8")));

  it("finds the client components (guards against the scan silently matching nothing)", () => {
    expect(clients.length).toBeGreaterThan(50);
    expect(clients.map((f) => relative(ROOT, f))).toContain("components/extension/ConnectConsent.tsx");
  });

  it('no "use client" module can reach lib/db/client.ts (it would crash in the browser: DATABASE_URL is not set)', () => {
    const offenders = clients.flatMap((f) => {
      const p = pathToForbidden(f);
      return p ? [p.join("  →  ")] : [];
    });
    expect(offenders).toEqual([]);
  });
});
