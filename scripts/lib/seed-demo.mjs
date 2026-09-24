import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export const DEMO_EMAIL = "demo@leadgennie.ai";

const SAMPLE_LEADS = [
  ["Avery Chen", "avery.chen@example.com", "Northwind Analytics", "VP Sales"],
  ["Jordan Patel", "jordan.patel@example.com", "Contoso Cloud", "Head of Growth"],
  ["Sam Okafor", "sam.okafor@example.com", "Fabrikam Labs", "Founder"],
  ["Riley Martin", "riley.martin@example.com", "Globex Software", "Director of Marketing"],
  ["Taylor Nguyen", "taylor.nguyen@example.com", "Initech Systems", "CTO"],
];

/**
 * Creates ONE demo workspace flagged is_demo = true (idempotent). `sql` is any
 * tagged-template client (Neon HTTP driver or the test adapter). Seeds only
 * real records — a user, a workspace, sample leads on the reserved example.com
 * domain — never fabricated metrics or campaign stats.
 *
 * @param {any} sql tagged-template SQL client
 * @param {{ password?: string, log?: (message: string) => void }} [options]
 */
export async function seedDemo(sql, { password, log = () => {} } = {}) {
  let generatedPassword = null;
  let [user] = await sql`select id from users where email = ${DEMO_EMAIL}`;
  if (!user) {
    generatedPassword = password ? null : randomBytes(9).toString("base64url");
    const hash = bcrypt.hashSync(password ?? generatedPassword, 10);
    [user] = await sql`
      insert into users (name, email, password_hash, company)
      values ('Demo User', ${DEMO_EMAIL}, ${hash}, 'Demo Workspace')
      returning id
    `;
    log(`Created demo user ${DEMO_EMAIL}`);
  } else {
    log("Demo user already present.");
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
    log(`Created demo workspace #${workspace.id}`);
  } else {
    await sql`update workspaces set is_demo = true where id = ${workspace.id}`;
    log("Demo workspace already present.");
  }

  for (const [name, email, company, title] of SAMPLE_LEADS) {
    await sql`
      insert into leads (workspace_id, full_name, email, company, job_title, source)
      values (${workspace.id}, ${name}, ${email}, ${company}, ${title}, 'demo')
      on conflict (workspace_id, lower(email)) where email is not null do nothing
    `;
  }
  log(`Demo leads ensured (${SAMPLE_LEADS.length}).`);

  return { userId: user.id, workspaceId: workspace.id, generatedPassword };
}
