"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { AppError, runAction, type ActionResult } from "@/lib/api";
import {
  getOnboardingFacts,
  getWorkspaceProfile,
  setOnboardingDismissed,
  updateWorkspaceProfile,
} from "@/lib/db/workspace-profile";
import { EMPTY_ICP, icpSchema, normalizeExcludedDomains, parseStoredIcp, type Icp } from "@/lib/domain/workspace/icp";
import { buildChecklist, type Checklist } from "@/lib/domain/workspace/onboarding";

export type WorkspaceProfileView = { positioning: string; companyName: string; icp: Icp };

export async function getProfile(): Promise<WorkspaceProfileView> {
  const { workspaceId } = await requireRole("viewer");
  const p = await getWorkspaceProfile(workspaceId);
  return { positioning: p.positioning ?? "", companyName: p.companyName ?? "", icp: parseStoredIcp(p.icp) ?? EMPTY_ICP };
}

const saveSchema = z.object({
  positioning: z.string().trim().max(2000),
  companyName: z.string().trim().max(200),
  icp: icpSchema,
});

/** Owner/admin: what we sell and who we sell to. Read by message generation and (from Phase 2) scoring. */
export async function saveWorkspaceProfile(input: unknown): Promise<ActionResult<WorkspaceProfileView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("admin");
    const parsed = saveSchema.parse(input);

    const { domains, invalid } = normalizeExcludedDomains(parsed.icp.exclusions.domains);
    if (invalid.length > 0) {
      throw new AppError("VALIDATION_ERROR", `Not a valid domain: ${invalid.slice(0, 3).join(", ")}`, [
        { path: "icp.exclusions.domains", message: `Not a valid domain: ${invalid.join(", ")}` },
      ]);
    }
    const icp: Icp = { ...parsed.icp, exclusions: { ...parsed.icp.exclusions, domains } };

    await updateWorkspaceProfile(workspaceId, {
      positioning: parsed.positioning || null,
      companyName: parsed.companyName || null,
      icp,
    });
    await logActivity({
      workspaceId, actorUserId: userId, type: "workspace.profile_updated", entityType: "workspace", entityId: workspaceId,
      summary: "Updated positioning and ICP",
    });
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings/positioning");
    return { positioning: parsed.positioning, companyName: parsed.companyName, icp };
  });
}

export async function getOnboardingChecklist(): Promise<Checklist> {
  const { workspaceId } = await requireRole("viewer");
  return buildChecklist(await getOnboardingFacts(workspaceId));
}

export async function dismissOnboarding(): Promise<ActionResult<null>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await setOnboardingDismissed(workspaceId, true);
    await logActivity({
      workspaceId, actorUserId: userId, type: "workspace.onboarding_dismissed", entityType: "workspace", entityId: workspaceId,
      summary: "Dismissed the setup checklist",
    });
    revalidatePath("/dashboard");
    return null;
  });
}
