/**
 * Workspace roles and their ranking — a plain module with NO database import, so client components (and anything that
 * ends up in the browser bundle) can use it. lib/workspace.ts re-exports these for the server code that already imports them.
 */
export type Role = "owner" | "admin" | "member" | "viewer";

export const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  member: 1,
  admin: 2,
  owner: 3,
};
