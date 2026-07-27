import { auth } from "@/auth";
import { ROLE_RANK, type Role } from "@/lib/workspace";

export type WorkspaceContext = {
  workspaceId: number;
  workspaceName: string;
  role: Role;
  userId: number;
  email: string;
};

/** Every workspace-scoped server action must resolve its tenant boundary through this. */
export async function requireWorkspace(): Promise<WorkspaceContext> {
  const session = await auth();
  if (!session?.user?.email || !session.user.workspaceId) {
    throw new Error("Not authenticated");
  }
  return {
    workspaceId: session.user.workspaceId,
    workspaceName: session.user.workspaceName,
    role: (session.user.role ?? "member") as Role,
    userId: Number(session.user.id),
    email: session.user.email,
  };
}

/** Use for mutating actions that require at least `minRole` in the active workspace. */
export async function requireRole(minRole: Role): Promise<WorkspaceContext> {
  const ctx = await requireWorkspace();
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) {
    throw new Error(`This action requires the "${minRole}" role or higher in this workspace.`);
  }
  return ctx;
}
