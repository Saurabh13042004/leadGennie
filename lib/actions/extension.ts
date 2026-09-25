"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { AppError, runAction, type ActionResult } from "@/lib/api";
import { listActiveSessions, revokeSessionRow, type SessionListItem } from "@/lib/db/extension-sessions";
import { approveConnection, connectParamsSchema, denyRedirect, type ConnectParams } from "@/lib/domain/extension/auth-service";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
import { ROLE_RANK } from "@/lib/workspace";

/**
 * The signed-in half of the extension connect flow, plus the Settings → Browser extension list.
 * Both consent buttons re-validate everything (redirect address, PKCE challenge) — the page's query string is
 * user-controllable, so it is never trusted just because it rendered.
 */

export async function approveExtensionConnection(params: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    const { workspaceId, userId, role } = await requireRole("viewer");
    const p: ConnectParams = connectParamsSchema.parse(params);
    const { redirectTo, scopes } = await approveConnection({ workspaceId, userId, role }, p, { automationEnabled: linkedinAutomationEnabled() });
    await logActivity({
      workspaceId, actorUserId: userId, type: "extension.connected", entityType: "workspace", entityId: workspaceId,
      summary: `Connected the browser extension${p.device ? ` (${p.device})` : ""}`, metadata: { scopes },
    });
    revalidatePath("/dashboard/settings/extension");
    return { redirectTo };
  });
}

export async function denyExtensionConnection(params: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  return runAction(async () => {
    await requireRole("viewer");
    return { redirectTo: denyRedirect(connectParamsSchema.parse(params)) };
  });
}

export type ExtensionSessionsView = { sessions: SessionListItem[]; canManageAll: boolean; currentUserId: number };

/** Admins/owners see every connected browser in the workspace; everyone else sees only their own. */
export async function listExtensionSessions(): Promise<ExtensionSessionsView> {
  const { workspaceId, userId, role } = await requireRole("viewer");
  const canManageAll = ROLE_RANK[role] >= ROLE_RANK.admin;
  return { sessions: await listActiveSessions(workspaceId, canManageAll ? undefined : userId), canManageAll, currentUserId: userId };
}

const idSchema = z.number().int().positive();

export async function revokeExtensionSession(sessionId: unknown): Promise<ActionResult<{ revoked: true }>> {
  return runAction(async () => {
    const { workspaceId, userId, role } = await requireRole("viewer");
    const id = idSchema.parse(sessionId);
    const isAdmin = ROLE_RANK[role] >= ROLE_RANK.admin;
    const ok = await revokeSessionRow(workspaceId, id, userId, isAdmin ? undefined : userId);
    if (!ok) throw new AppError("NOT_FOUND", "That connection was not found (it may already be disconnected).");
    await logActivity({
      workspaceId, actorUserId: userId, type: "extension.revoked", entityType: "workspace", entityId: workspaceId,
      summary: "Disconnected a browser extension", metadata: { session_id: id },
    });
    revalidatePath("/dashboard/settings/extension");
    return { revoked: true as const };
  });
}
