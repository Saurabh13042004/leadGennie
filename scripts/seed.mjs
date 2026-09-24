// Creates ONE demo workspace, flagged workspaces.is_demo = true, so demos,
// tests and E2E runs never mix with real customer data.
//
//   npm run db:seed -- --yes                      (password printed once if not supplied)
//   SEED_DEMO_PASSWORD=... npm run db:seed -- --yes
//   node --env-file=.env.local scripts/seed.mjs --yes --env=DATABASE_URL_TEST
//
// Idempotent. Seeds only real *records* (a user, a workspace, sample leads on
// the reserved example.com domain) — never fabricated metrics or campaign stats.
import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="));
const envName = envArg ? envArg.slice("--env=".length) : "DATABASE_URL";
const url = process.env[envName];

if (!url) {
  console.error(`${envName} is not set`);
  process.exit(1);
}
if (!args.includes("--yes")) {
  console.error(`Refusing to seed ${envName} without --yes (this writes a demo user + workspace).`);
  process.exit(1);
}

const sql = neon(url);
const demoEmail = "demo@leadgennie.ai";

let [user] = await sql`select id from users where email = ${demoEmail}`;
if (!user) {
  const password = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  const hash = bcrypt.hashSync(password, 10);
  [user] = await sql`
    insert into users (name, email, password_hash, company)
    values ('Demo User', ${demoEmail}, ${hash}, 'Demo Workspace')
    returning id
  `;
  console.log(`Created demo user ${demoEmail}`);
  if (!process.env.SEED_DEMO_PASSWORD) console.log(`Password (shown once): ${password}`);
} else {
  console.log("Demo user already present.");
}

let [workspace] = await sql`select id from workspaces where slug = 'demo-workspace'`;
if (!workspace) {
  [workspace] = await sql`
    insert into workspaces (name, slug, created_by_user_id, is_demo)
    values ('Demo Workspace', 'demo-workspace', ${user.id}, true)
    returning id
  `;
  await sql`
    insert into workspace_members (workspace_id, user_id, role, status)
    values (${workspace.id}, ${user.id}, 'owner', 'active')
  `;
  console.log(`Created demo workspace #${workspace.id}`);
} else {
  await sql`update workspaces set is_demo = true where id = ${workspace.id}`;
  console.log("Demo workspace already present.");
}

const sampleLeads = [
  ["Avery Chen", "avery.chen@example.com", "Northwind Analytics", "VP Sales"],
  ["Jordan Patel", "jordan.patel@example.com", "Contoso Cloud", "Head of Growth"],
  ["Sam Okafor", "sam.okafor@example.com", "Fabrikam Labs", "Founder"],
  ["Riley Martin", "riley.martin@example.com", "Globex Software", "Director of Marketing"],
  ["Taylor Nguyen", "taylor.nguyen@example.com", "Initech Systems", "CTO"],
];
for (const [name, email, company, title] of sampleLeads) {
  await sql`
    insert into leads (workspace_id, full_name, email, company, job_title, source)
    values (${workspace.id}, ${name}, ${email}, ${company}, ${title}, 'demo')
    on conflict (workspace_id, lower(email)) where email is not null do nothing
  `;
}
console.log(`Demo leads ensured (${sampleLeads.length}).`);
