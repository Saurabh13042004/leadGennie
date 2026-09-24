// Static gate (docs/06-quality-and-testing.md, rule 5 "no mock data in
// authenticated flows"). Fails the build if UI/app code contains patterns that
// fabricate numbers or endorsements.
//
//   node scripts/checks/no-fake-metrics.mjs
//
// Escape hatch: put `demo-data-ok` in a comment on the SAME line (or the line
// above) for content that is explicitly rendered under a visible "Demo data"
// label. Use it sparingly — reviewers should question every one.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];
const EXT = /\.(ts|tsx)$/;

const RULES = [
  {
    id: "random-in-ui",
    why: "Math.random() must not generate displayed values. Visual-only effects go in the allow-list below.",
    re: /Math\.random\s*\(/,
    dirs: ["app", "components", "lib"],
    // Purely decorative particle animation — renders no numbers.
    allowFiles: ["components/BackgroundEffects.tsx"],
  },
  {
    id: "hash-derived-number",
    why: "Numbers derived from a string hash are fabricated data (e.g. hashRate/hashToRange).",
    re: /\bhash(Rate|ToRange|ToNumber)\b/,
    dirs: ["app", "components", "lib"],
  },
  {
    id: "metric-literal",
    why: "Hard-coded performance metric in UI copy (e.g. '+31% Avg Reply Rate', '92% inbox placement').",
    re: /[+-]?\d+(\.\d+)?\s?%\s*(avg\.?\s*)?(reply|open|click|ctr|placement|response|higher|lift)/i,
    dirs: ["app", "components"],
  },
  {
    id: "score-literal",
    why: "Hard-coded lead score / accuracy claim in UI copy.",
    re: /\b\d{2,3}\s*\/\s*100\b|\b\d{2,3}\s?%\s*(accuracy|match)/i,
    dirs: ["app", "components"],
  },
  {
    id: "hardcoded-provider-key",
    why: "Publishable/secret key literal committed to source — use an env var with no fallback.",
    re: /\bpk_[A-Za-z0-9]{16,}|\bsk_[A-Za-z0-9]{16,}|AIza[0-9A-Za-z_-]{30,}/,
    dirs: ["app", "components", "lib"],
  },
  {
    id: "third-party-logo-marquee",
    why: "Third-party brand logos imply customer endorsement. Only show logos of real, connected integrations.",
    re: /img\.logo\.dev/,
    dirs: ["app", "components"],
  },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (EXT.test(name)) yield full;
  }
}

const violations = [];
for (const top of SCAN_DIRS) {
  let files;
  try {
    files = [...walk(join(ROOT, top))];
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join("/");
    const lines = readFileSync(file, "utf-8").split("\n");
    for (const rule of RULES) {
      if (!rule.dirs.includes(top)) continue;
      if (rule.allowFiles?.includes(rel)) continue;
      lines.forEach((line, i) => {
        if (!rule.re.test(line)) return;
        if (/demo-data-ok/.test(line) || /demo-data-ok/.test(lines[i - 1] ?? "")) return;
        violations.push({ rule, rel, line: i + 1, text: line.trim().slice(0, 120) });
      });
    }
  }
}

if (violations.length > 0) {
  console.error(`no-fake-metrics: ${violations.length} violation(s)\n`);
  for (const v of violations) {
    console.error(`  [${v.rule.id}] ${v.rel}:${v.line}\n    ${v.text}\n    → ${v.rule.why}\n`);
  }
  process.exit(1);
}
console.log("no-fake-metrics: OK");
