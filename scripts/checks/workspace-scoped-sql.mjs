// Static gate (docs/06-quality-and-testing.md (c), rule 10): every UPDATE /
// DELETE against a workspace-owned table must filter by workspace_id in the
// same statement, so an id from the client can never touch another tenant's row.
//
//   node scripts/checks/workspace-scoped-sql.mjs
//
// Escape hatch: `workspace-scope-ok: <reason>` in a comment inside the SQL
// (or on the line above the statement) for the rare legitimate exception
// (e.g. a child table scoped through its parent in the same statement).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const ROOT = process.cwd();

// Tables that carry workspace_id. Child tables without it (campaign_steps,
// workflow_steps) are reached only via a parent whose workspace is verified.
const WS_TABLES = [
  "leads", "segments", "campaigns", "campaign_sends", "crm_connections", "api_tokens",
  "do_not_contact", "import_jobs", "activities", "approvals", "pipelines", "pipeline_stages",
  "deals", "tasks", "message_generations", "prompts", "prompt_versions", "domains",
  "mailboxes", "forms", "form_submissions", "workflows", "workspace_members",
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (/\.(ts|tsx)$/.test(name)) yield full;
  }
}

const stmtRe = /\b(update|delete\s+from)\s+(?:only\s+)?("?)(\w+)\2/gi;
const violations = [];

for (const top of ["app", "lib"]) {
  for (const file of walk(join(ROOT, top))) {
    const src = readFileSync(file, "utf-8");
    // Only look inside template literals / strings that contain SQL.
    const literalRe = /`([^`]*)`/g;
    let m;
    while ((m = literalRe.exec(src))) {
      const body = m[1];
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
