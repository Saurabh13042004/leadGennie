// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The extension has no build step, so nothing catches a mistyped import before Chrome loads the page — and a single bad
 * binding blanks the whole popup (this exact bug shipped once during development). This walks every module in
 * chrome-extension/ and checks that each named import is really exported by the file it points at, that relative
 * imports resolve, and that nothing in web_accessible_resources is missing.
 */
const ROOT = resolve(__dirname, "../../chrome-extension");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : /\.(m?js)$/.test(n) ? [p] : [];
  });
}

function exportsOf(src: string): Set<string> {
  const out = new Set<string>();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) for (const part of m[1].split(",")) out.add(part.trim().split(/\s+as\s+/).pop()!.trim());
  return out;
}

const all = files(ROOT);

describe("chrome-extension module graph", () => {
  it("every relative import resolves to a real file, and every named import is exported by it", () => {
    const problems: string[] = [];
    for (const file of all) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/import\s*(?:([\w$]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        const target = resolve(dirname(file), m[3]);
        if (!all.includes(target)) {
          problems.push(`${relative(ROOT, file)}: cannot resolve ${m[3]}`);
          continue;
        }
        const exported = exportsOf(readFileSync(target, "utf8"));
        for (const name of (m[2] ?? "").split(",").map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
          if (!exported.has(name)) problems.push(`${relative(ROOT, file)}: '${name}' is not exported by ${m[3]}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("every file the on-page widget imports is listed in web_accessible_resources (else the widget silently never loads)", () => {
    const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
    const exposed = new Set<string>(manifest.web_accessible_resources.flatMap((r: { resources: string[] }) => r.resources));
    const seen = new Set<string>();
    const visit = (file: string) => {
      const rel = relative(ROOT, file);
      if (seen.has(rel)) return;
      seen.add(rel);
      for (const m of readFileSync(file, "utf8").matchAll(/from\s*['"](\.{1,2}\/[^'"]+)['"]/g)) visit(resolve(dirname(file), m[1]));
    };
    visit(join(ROOT, "content/widget.mjs"));
    const missing = [...seen].filter((f) => !exposed.has(f));
    expect(missing).toEqual([]);
  });

  it("every path the manifest names exists", () => {
    const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
    const paths = [
      m.background.service_worker, m.action.default_popup, m.options_ui.page, ...Object.values(m.icons as Record<string, string>),
      ...m.content_scripts.flatMap((c: { js: string[] }) => c.js),
    ] as string[];
    for (const p of paths) expect(() => statSync(join(ROOT, p)), p).not.toThrow();
  });
});
