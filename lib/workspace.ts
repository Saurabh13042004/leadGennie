import { sql } from "@/lib/db/client";

export type Role = "owner" | "admin" | "member" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};

export type PrimaryWorkspace = {
  id: number;
  name: string;
  role: Role;
};

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "workspace";
}

async function uniqueSlug(base: string) {
  const baseSlug = slugify(base);
  let attempt = 0;
  while (true) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`;
    const existing = await sql`select 1 from workspaces where slug = ${candidate}`;
    if (existing.length === 0) return candidate;
    attempt++;
  }
}

/** Activates any pending invites for this email, linking them to the new user. Returns workspace ids joined. */
async function activatePendingInvites(userId: number, email: string): Promise<number[]> {
  const rows = await sql`
    update workspace_members
    set user_id = ${userId}, status = 'active', invited_email = null
    where invited_email is not null and lower(invited_email) = lower(${email}) and status = 'invited'
    returning workspace_id
  `;
  return rows.map((r) => r.workspace_id as number);
}

async function createPersonalWorkspace(userId: number, displayName: string) {
  const slug = await uniqueSlug(displayName);
  const [workspace] = await sql`
    insert into workspaces (name, slug, created_by_user_id)
    values (${displayName}, ${slug}, ${userId})
    returning id
  `;
  await sql`
    insert into workspace_members (workspace_id, user_id, role, status)
    values (${workspace.id}, ${userId}, 'owner', 'active')
  `;
  return workspace.id as number;
}

/**
 * Called once at account creation. If the email has pending workspace invites,
 * joins those instead of provisioning a new personal workspace — an invited
 * teammate should land in the team's workspace, not a fresh empty one.
 */
export async function ensureUserWorkspace(
  userId: number,
  email: string,
  name: string,
  company?: string | null
) {
  const joined = await activatePendingInvites(userId, email);
  if (joined.length > 0) return;

  const displayName = company?.trim() || `${name}'s Workspace`;
  await createPersonalWorkspace(userId, displayName);
}

/** The workspace used for the session: the one this user owns, or their earliest membership. */
export async function getPrimaryWorkspace(userId: number): Promise<PrimaryWorkspace | null> {
  const rows = await sql`
    select w.id, w.name, wm.role
    from workspace_members wm
    join workspaces w on w.id = wm.workspace_id
    where wm.user_id = ${userId} and wm.status = 'active'
    order by (wm.role = 'owner') desc, wm.created_at asc
    limit 1
  `;
  const row = rows[0];
  if (!row) return null;
  return { id: row.id as number, name: row.name as string, role: row.role as Role };
}
