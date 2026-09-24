import { ROLE_RANK, type Role } from "@/lib/workspace";
import type { WorkspaceContext } from "@/lib/auth/workspace-context";

/**
 * Stand-in for the NextAuth session behind requireWorkspace/requireRole.
 * Role enforcement is REAL (same ranking as production) — only the session
 * lookup is faked, so tests exercise the actual authorization checks.
 */
let current: WorkspaceContext | null = null;

export function setSession(ctx: { workspaceId: number; userId: number; email: string; role?: Role } | null) {
  current = ctx && { workspaceName: "Test", role: "owner", ...ctx };
}

export async function fakeRequireWorkspace(): Promise<WorkspaceContext> {
  if (!current) throw new Error("Not authenticated");
  return current;
}

export async function fakeRequireRole(minRole: Role): Promise<WorkspaceContext> {
  const ctx = await fakeRequireWorkspace();
  if (ROLE_RANK[ctx.role] < ROLE_RANK[minRole]) {
    throw new Error(`This action requires the "${minRole}" role or higher in this workspace.`);
  }
  return ctx;
}
