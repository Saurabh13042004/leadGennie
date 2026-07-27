"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole, requireWorkspace } from "@/lib/auth/workspace-context";
import { ROLE_RANK, type Role } from "@/lib/workspace";

export type WorkspaceInfo = {
  id: number;
  name: string;
  role: Role;
};

export async function getWorkspaceInfo(): Promise<WorkspaceInfo> {
  const ctx = await requireWorkspace();
  return { id: ctx.workspaceId, name: ctx.workspaceName, role: ctx.role };
}

export type Member = {
  id: number;
  userId: number | null;
  name: string | null;
  email: string;
  role: Role;
  status: "active" | "invited";
  createdAt: string;
};

export async function listMembers(): Promise<Member[]> {
  const { workspaceId } = await requireWorkspace();
  const rows = await sql`
    select
      wm.id, wm.user_id, wm.role, wm.status, wm.created_at,
      coalesce(u.name, null) as name,
      coalesce(u.email, wm.invited_email) as email
    from workspace_members wm
    left join users u on u.id = wm.user_id
    where wm.workspace_id = ${workspaceId}
    order by (wm.role = 'owner') desc, wm.created_at asc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    userId: r.user_id as number | null,
    name: r.name as string | null,
    email: r.email as string,
    role: r.role as Role,
    status: r.status as "active" | "invited",
    createdAt: r.created_at as string,
  }));
}

const INVITABLE_ROLES: Role[] = ["admin", "member", "viewer"];

export async function inviteMember(email: string, role: Role) {
  const { workspaceId, userId } = await requireRole("admin");
  const trimmedEmail = email.trim().toLowerCase();

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    throw new Error("Enter a valid email address.");
  }
  if (!INVITABLE_ROLES.includes(role)) {
    throw new Error("Invalid role for invitation.");
  }

  const existingMember = await sql`
    select 1 from workspace_members wm
    left join users u on u.id = wm.user_id
    where wm.workspace_id = ${workspaceId}
      and lower(coalesce(u.email, wm.invited_email)) = ${trimmedEmail}
  `;
  if (existingMember.length > 0) {
    throw new Error("This person is already a member or has a pending invite.");
  }

  const existingUser = await sql`select id from users where lower(email) = ${trimmedEmail}`;

  if (existingUser.length > 0) {
    await sql`
      insert into workspace_members (workspace_id, user_id, role, status, invited_by_user_id)
      values (${workspaceId}, ${existingUser[0].id}, ${role}, 'active', ${userId})
    `;
  } else {
    await sql`
      insert into workspace_members (workspace_id, invited_email, role, status, invited_by_user_id)
      values (${workspaceId}, ${trimmedEmail}, ${role}, 'invited', ${userId})
    `;
  }

  revalidatePath("/dashboard/workspace");
}

export async function updateMemberRole(memberId: number, newRole: Role) {
  const ctx = await requireRole("admin");

  const rows = await sql`
    select role from workspace_members where id = ${memberId} and workspace_id = ${ctx.workspaceId}
  `;
  const currentRole = rows[0]?.role as Role | undefined;
  if (!currentRole) throw new Error("Member not found.");

  if ((currentRole === "owner" || newRole === "owner") && ctx.role !== "owner") {
    throw new Error("Only an owner can change owner-level access.");
  }

  if (currentRole === "owner" && newRole !== "owner") {
    const owners = await sql`
      select count(*)::int as count from workspace_members
      where workspace_id = ${ctx.workspaceId} and role = 'owner' and status = 'active'
    `;
    if ((owners[0].count as number) <= 1) {
      throw new Error("A workspace must keep at least one owner.");
    }
  }

  await sql`
    update workspace_members set role = ${newRole}
    where id = ${memberId} and workspace_id = ${ctx.workspaceId}
  `;
  revalidatePath("/dashboard/workspace");
}

export async function removeMember(memberId: number) {
  const ctx = await requireRole("admin");

  const rows = await sql`
    select role, user_id from workspace_members where id = ${memberId} and workspace_id = ${ctx.workspaceId}
  `;
  const target = rows[0] as { role: Role; user_id: number | null } | undefined;
  if (!target) throw new Error("Member not found.");

  if (target.role === "owner" && ctx.role !== "owner") {
    throw new Error("Only an owner can remove another owner.");
  }
  if (target.user_id === ctx.userId) {
    throw new Error("You can't remove yourself from the workspace.");
  }
  if (target.role === "owner") {
    const owners = await sql`
      select count(*)::int as count from workspace_members
      where workspace_id = ${ctx.workspaceId} and role = 'owner' and status = 'active'
    `;
    if ((owners[0].count as number) <= 1) {
      throw new Error("A workspace must keep at least one owner.");
    }
  }
  if (ROLE_RANK[target.role] > ROLE_RANK[ctx.role]) {
    throw new Error("You can't remove a member with a higher role than yours.");
  }

  await sql`delete from workspace_members where id = ${memberId} and workspace_id = ${ctx.workspaceId}`;
  revalidatePath("/dashboard/workspace");
}
