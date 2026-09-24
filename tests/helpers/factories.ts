import { sql } from "./test-db";

let counter = 0;
const uniq = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export async function createUser(overrides: { email?: string; name?: string } = {}) {
  const email = overrides.email ?? `user-${uniq()}@example.com`;
  const [row] = await sql`
    insert into users (name, email, password_hash)
    values (${overrides.name ?? "Test User"}, ${email}, 'x')
    returning id, email
  `;
  return { id: Number(row.id), email: row.email as string };
}

/** A workspace with one owner. Returns ids as numbers. */
export async function createWorkspace(overrides: { name?: string; isDemo?: boolean } = {}) {
  const user = await createUser();
  const name = overrides.name ?? `Workspace ${uniq()}`;
  const [ws] = await sql`
    insert into workspaces (name, slug, created_by_user_id, is_demo)
    values (${name}, ${`ws-${uniq()}`}, ${user.id}, ${overrides.isDemo ?? false})
    returning id
  `;
  const workspaceId = Number(ws.id);
  await sql`
    insert into workspace_members (workspace_id, user_id, role, status)
    values (${workspaceId}, ${user.id}, 'owner', 'active')
  `;
  return { workspaceId, user };
}

export async function createLead(
  workspaceId: number,
  overrides: { fullName?: string; email?: string | null; company?: string } = {},
) {
  const email = overrides.email === undefined ? `lead-${uniq()}@example.com` : overrides.email;
  const [row] = await sql`
    insert into leads (workspace_id, full_name, email, company)
    values (${workspaceId}, ${overrides.fullName ?? "Test Lead"}, ${email}, ${overrides.company ?? "Acme"})
    returning id
  `;
  return { id: Number(row.id), email };
}
