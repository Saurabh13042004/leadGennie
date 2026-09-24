// Static gate (docs/06-quality-and-testing.md (c), rule 10): every UPDATE /
// DELETE against a workspace-owned table must filter by workspace_id in the
// same statement, so an id from the client can never touch another tenant's row.
//
//   node scripts/checks/workspace-scoped-sql.mjs
//
// Escape hatch: `workspace-scope-ok: <reason>` in a comment inside the SQL
// (or on the line above the statement) for the rare legitimate exception
// (e.g. a child table scoped through its parent in the same statement).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

// Tables that carry workspace_id. Child tables without it (campaign_steps,
// workflow_steps) are reached only via a parent whose workspace is verified.
const WS_TABLES = [
  "leads", "segments", "campaigns", "campaign_sends", "crm_connections", "api_tokens",
  "do_not_contact", "import_jobs", "activities", "approvals", "pipelines", "pipeline_stages",
  "deals", "tasks", "message_generations", "prompts", "prompt_versions", "domains",
  "mailboxes", "forms", "form_submissions", "workflows", "workspace_members",
  // Phase 3
  "message_drafts", "message_draft_edits",
  // Phase 2B
  "jobs", "usage_records", "agent_runs", "agent_run_steps", "lead_research", "signals", "evidence",
  "field_provenance", "prospect_candidates", "companies",
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}


/**
 * Extracts every template literal from TS source, with `${...}` expressions
 * collapsed to "?". Handles nesting (a template inside an expression inside a
 * template), which SQL built with .map()/.join() relies on — a plain
 * /`[^`]*`/ regex splits such statements in the middle.
 */
function templateLiterals(src) {
  const out = [];
  const n = src.length;

  function scanCode(i, untilBrace) {
    let depth = 0;
    while (i < n) {
      const ch = src[i];
      const next = src[i + 1];
      if (ch === "`") { i = scanTemplate(i); continue; }
      if (ch === "'" || ch === '"') {
        i++;
        while (i < n && src[i] !== ch) i += src[i] === "\\" ? 2 : 1;
        i++;
        continue;
      }
      if (ch === "/" && next === "/") { while (i < n && src[i] !== "\n") i++; continue; }
      if (ch === "/" && next === "*") { i = src.indexOf("*/", i + 2); i = i === -1 ? n : i + 2; continue; }
      if (untilBrace) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          if (depth === 0) return i + 1;
          depth--;
        }
      }
      i++;
    }
    return i;
  }

  function scanTemplate(start) {
    let i = start + 1;
    let text = "";
    while (i < n) {
      const ch = src[i];
      if (ch === "\\") { text += src.slice(i, i + 2); i += 2; continue; }
      if (ch === "`") { out.push({ text, index: start }); return i + 1; }
      if (ch === "$" && src[i + 1] === "{") { text += "?"; i = scanCode(i + 2, true); continue; }
      text += ch;
      i++;
    }
    return i;
  }

  scanCode(0, false);
  return out;
}

const stmtRe = /\b(update|delete\s+from)\s+(?:only\s+)?("?)(\w+)\2/gi;
const violations = [];

for (const top of ["app", "lib"]) {
  if (!existsSync(join(ROOT, top))) continue;
  for (const file of walk(join(ROOT, top))) {
    const src = readFileSync(file, "utf-8");
    // Only look inside template literals / strings that contain SQL.
    for (const lit of templateLiterals(src)) {
      const m = { index: lit.index };
      const body = lit.text;
      stmtRe.lastIndex = 0;
      let s;
      while ((s = stmtRe.exec(body))) {
        const table = s[3].toLowerCase();
        if (!WS_TABLES.includes(table)) continue;
        // Skip prose in comments/strings that merely mention "update leads".
        if (!/\bset\b|\bwhere\b|\busing\b/i.test(body.slice(s.index))) continue;
        const stmt = body.slice(s.index);
        if (/workspace_id/i.test(stmt) || /workspace-scope-ok/.test(body)) continue;
        const line = src.slice(0, m.index + 1 + s.index).split("\n").length;
        const before = src.split("\n")[line - 2] ?? "";
        if (/workspace-scope-ok/.test(before)) continue;
        violations.push({ file: relative(ROOT, file).split(sep).join("/"), line, table, text: stmt.trim().split("\n")[0].slice(0, 100) });
      }
    }
  }
}

if (violations.length) {
  console.error(`workspace-scoped-sql: ${violations.length} unscoped UPDATE/DELETE\n`);
  for (const v of violations) console.error(`  ${v.file}:${v.line} [${v.table}]  ${v.text}`);
  console.error("\nAdd `and workspace_id = ${workspaceId}` (see docs/04-engineering-rules.md rule 10).");
  process.exit(1);
}
console.log("workspace-scoped-sql: OK");
