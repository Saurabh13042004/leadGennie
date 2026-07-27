import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

function slugify(input) {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "workspace"
  );
}

async function uniqueSlug(base) {
  let slug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt}`;
    const existing = await sql`select 1 from workspaces where slug = ${candidate}`;
    if (existing.length === 0) return candidate;
    attempt++;
  }
}

console.log("Backfilling personal workspaces for existing users without one...");

const users = await sql`
  select u.id, u.email, u.name, u.company
  from users u
  where not exists (
    select 1 from workspace_members wm where wm.user_id = u.id
  )
`;

for (const user of users) {
  const workspaceName = user.company?.trim() || `${user.name}'s Workspace`;
  const slug = await uniqueSlug(workspaceName);

  const [workspace] = await sql`
    insert into workspaces (name, slug, created_by_user_id)
    values (${workspaceName}, ${slug}, ${user.id})
    returning id
  `;

  await sql`
    insert into workspace_members (workspace_id, user_id, role, status)
    values (${workspace.id}, ${user.id}, 'owner', 'active')
  `;

  console.log(`Created workspace "${workspaceName}" (#${workspace.id}) for ${user.email}`);
}

console.log("Backfilling workspace_id on existing business records...");

async function backfillByOwnerEmail(table) {
  const result = await sql.query(
    `update ${table} t
     set workspace_id = wm.workspace_id
     from workspace_members wm
     join users u on u.id = wm.user_id
     where t.workspace_id is null
       and lower(u.email) = lower(t.owner_email)
       and wm.role = 'owner'
     returning t.id`
  );
  console.log(`  ${table}: backfilled ${result.length} row(s)`);
}

for (const table of ["leads", "segments", "campaigns", "crm_connections", "api_tokens"]) {
  await backfillByOwnerEmail(table);
}

// campaign_sends has no owner_email column; inherit workspace_id from its campaign.
const csBackfilled = await sql`
  update campaign_sends cs
  set workspace_id = c.workspace_id
  from campaigns c
  where cs.workspace_id is null and cs.campaign_id = c.id
  returning cs.id
`;
console.log(`  campaign_sends: backfilled ${csBackfilled.length} row(s) from campaigns`);

const orphanChecks = [
  ["leads", "select count(*)::int as c from leads where workspace_id is null"],
  ["segments", "select count(*)::int as c from segments where workspace_id is null"],
  ["campaigns", "select count(*)::int as c from campaigns where workspace_id is null"],
  ["campaign_sends", "select count(*)::int as c from campaign_sends where workspace_id is null"],
];

let hasOrphans = false;
for (const [table, query] of orphanChecks) {
  const rows = await sql.query(query);
  const count = rows[0].c;
  if (count > 0) {
    hasOrphans = true;
    console.warn(`  WARNING: ${table} has ${count} row(s) with no workspace_id (no matching user/owner workspace).`);
  }
}

if (hasOrphans) {
  console.warn(
    "Skipping NOT NULL enforcement because orphaned rows exist. Resolve them, then re-run this script."
  );
} else {
  console.log("No orphaned rows. Enforcing NOT NULL on workspace_id...");
  await sql.query(`alter table leads alter column workspace_id set not null`);
  await sql.query(`alter table segments alter column workspace_id set not null`);
  await sql.query(`alter table campaigns alter column workspace_id set not null`);
  await sql.query(`alter table campaign_sends alter column workspace_id set not null`);
  console.log("NOT NULL constraints applied to leads, segments, campaigns, campaign_sends.");
}

// api_tokens moves from one-token-per-user to one-token-per-workspace.
const tokenOrphans = await sql`select count(*)::int as c from api_tokens where workspace_id is null`;
if (tokenOrphans[0].c === 0) {
  await sql.query(`alter table api_tokens alter column workspace_id set not null`);
  await sql.query(`alter table api_tokens drop constraint if exists api_tokens_owner_email_key`);
  await sql.query(
    `create unique index if not exists api_tokens_workspace_id_idx on api_tokens (workspace_id)`
  );
  console.log("api_tokens: workspace_id enforced and re-keyed as one token per workspace.");
} else {
  console.warn(`  WARNING: api_tokens has ${tokenOrphans[0].c} row(s) with no workspace_id.`);
}

// crm_connections: add workspace-scoped uniqueness alongside the legacy one.
const crmOrphans = await sql`select count(*)::int as c from crm_connections where workspace_id is null`;
if (crmOrphans[0].c === 0) {
  await sql.query(
    `create unique index if not exists crm_connections_workspace_provider_portal_idx
     on crm_connections (workspace_id, provider, portal_id)`
  );
  console.log("crm_connections: workspace-scoped unique index created.");
}

console.log("Workspace migration complete.");
