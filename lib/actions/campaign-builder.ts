"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { mapAiError, runAction, type ActionResult } from "@/lib/api";
import { decideApproval } from "@/lib/actions/approvals";
import { resolveAudience } from "@/lib/domain/campaigns/audience";
import { cancelCampaign, launchCampaign, pauseCampaign, resumeCampaign, submitForApproval, type LaunchResult } from "@/lib/domain/campaigns/lifecycle";
import { approveCleanAudienceDrafts, generateAudienceDrafts } from "@/lib/domain/campaigns/personalization";
import { previewCandidates, previewForLead, sendTestEmail, type CampaignPreview } from "@/lib/domain/campaigns/preview";
import { getCampaignDetail, listCampaignItems, type CampaignDetail, type CampaignListItem } from "@/lib/domain/campaigns/read-model";
import { checkReadiness } from "@/lib/domain/campaigns/readiness";
import { loadCampaign, loadSentStepIds } from "@/lib/domain/campaigns/repository";
import { createDraftCampaign, createFromWizard, updateAudience, updateBasics, updateSteps } from "@/lib/domain/campaigns/service";
import { audienceDefinitionSchema } from "@/lib/domain/campaigns/types";
import { toAudienceView, toReadinessView, type AudienceView, type BuilderView } from "@/lib/domain/campaigns/views";

/** Campaign builder facade: authenticate → validate → domain service → envelope. No business rules live here. */

const idSchema = z.number().int().positive();

function refresh(id?: number) {
  revalidatePath("/dashboard/campaigns");
  if (id) {
    revalidatePath(`/dashboard/campaigns/${id}`);
    revalidatePath(`/dashboard/campaigns/${id}/edit`);
  }
}

export async function listCampaignsView(): Promise<CampaignListItem[]> {
  const { workspaceId } = await requireRole("viewer");
  return listCampaignItems(workspaceId);
}

export async function getCampaignDetailView(id: number, opts?: { status?: string }): Promise<CampaignDetail> {
  const { workspaceId } = await requireRole("viewer");
  return getCampaignDetail(workspaceId, idSchema.parse(Number(id)), { status: opts?.status });
}

export async function getBuilderView(id: number): Promise<BuilderView> {
  const { workspaceId } = await requireRole("viewer");
  return builderView(workspaceId, idSchema.parse(Number(id)));
}

async function builderView(workspaceId: number, id: number): Promise<BuilderView> {
  const campaign = await loadCampaign(workspaceId, id);
  const [readiness, locked] = await Promise.all([checkReadiness(workspaceId, campaign), loadSentStepIds(workspaceId, id)]);
  return { campaign, readiness: toReadinessView(readiness), lockedStepIds: [...locked] };
}

const createSchema = z.object({ name: z.string().max(200), workflowId: z.number().int().positive().nullable().optional() });

export async function createCampaignDraft(input: unknown): Promise<ActionResult<{ id: number }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const { name, workflowId } = createSchema.parse(input);
    const id = await createDraftCampaign({ workspaceId, userId }, { name, workflowId });
    refresh();
    return { id };
  });
}

const wizardSchema = z.object({
  name: z.string().max(200),
  // Ids come from list actions where Postgres bigints arrive as strings — coerce, don't reject.
  audienceSegmentId: z.coerce.number().int().positive().nullable(),
  mailboxId: z.coerce.number().int().positive().nullable(),
  dailyLimit: z.number().int().min(1).max(1000),
  steps: z.array(z.object({ waitDays: z.number().int().min(0).max(90), subject: z.string().max(200).optional(), body: z.string().max(8000) })).min(1).max(10),
  workflowId: z.coerce.number().int().positive().nullable().optional(),
});

/**
 * "New campaign" wizard → an email campaign, submitted for approval in the same click. If something still blocks it
 * (no mailbox, empty audience, …) the campaign is kept as a draft and the blockers come back so the UI can open the
 * builder where they're fixed.
 */
export async function createCampaignFromWizard(input: unknown): Promise<ActionResult<{ id: number; submitted: boolean; blockers: string[] }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const actor = { workspaceId, userId };
    const id = await createFromWizard(actor, wizardSchema.parse(input));
    const readiness = await checkReadiness(workspaceId, await loadCampaign(workspaceId, id));
    if (readiness.blockers.length > 0) {
      refresh(id);
      return { id, submitted: false, blockers: readiness.blockers.map((b) => b.message) };
    }
    await submitForApproval(actor, id);
    refresh(id);
    revalidatePath("/dashboard/brief");
    return { id, submitted: true, blockers: [] };
  });
}

/** Saves one builder section and returns the fresh campaign + readiness (so the checklist updates with every save). */
async function saveSection(id: unknown, save: (actor: { workspaceId: number; userId: number }, id: number) => Promise<unknown>): Promise<ActionResult<BuilderView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const cid = idSchema.parse(id);
    await save({ workspaceId, userId }, cid);
    refresh(cid);
    return builderView(workspaceId, cid);
  });
}

export async function saveCampaignBasics(id: unknown, input: unknown) {
  return saveSection(id, (a, cid) => updateBasics(a, cid, input));
}

export async function saveCampaignAudience(id: unknown, input: unknown) {
  return saveSection(id, (a, cid) => updateAudience(a, cid, input));
}

export async function saveCampaignSteps(id: unknown, input: unknown) {
  return saveSection(id, (a, cid) => updateSteps(a, cid, input));
}

/** Live count while editing the audience — resolves without saving. */
export async function previewAudience(id: unknown, input: unknown): Promise<ActionResult<AudienceView>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    return toAudienceView(await resolveAudience(workspaceId, audienceDefinitionSchema.parse(input), { excludeCampaignId: idSchema.parse(id) }));
  });
}

export async function generateCampaignDrafts(id: unknown) {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const r = await generateAudienceDrafts({ workspaceId, userId }, idSchema.parse(id));
    revalidatePath("/dashboard/leads/drafts");
    return r;
  });
}

export async function approveCampaignDrafts(id: unknown) {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const r = await approveCleanAudienceDrafts({ workspaceId, userId }, idSchema.parse(id));
    revalidatePath("/dashboard/leads/drafts");
    return r;
  });
}

export async function getCampaignPreview(id: unknown, leadId: unknown): Promise<ActionResult<CampaignPreview>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    return previewForLead(workspaceId, idSchema.parse(id), idSchema.parse(leadId));
  });
}

export async function getCampaignPreviewLeads(id: unknown): Promise<ActionResult<{ id: number; name: string; excluded: string | null }[]>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    return previewCandidates(workspaceId, idSchema.parse(id));
  });
}

export async function sendCampaignTest(id: unknown, leadId: unknown, stepOrder: unknown): Promise<ActionResult<{ to: string }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    try {
      return await sendTestEmail({ workspaceId, userId }, idSchema.parse(id), idSchema.parse(leadId), idSchema.parse(stepOrder));
    } catch (err) {
      throw mapAiError(err);
    }
  });
}

export async function submitCampaign(id: unknown): Promise<ActionResult<{ approvalId: number }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const cid = idSchema.parse(id);
    const { approvalId } = await submitForApproval({ workspaceId, userId }, cid);
    refresh(cid);
    revalidatePath("/dashboard/brief");
    return { approvalId };
  });
}

/** Owner/admin decision on a pending launch — the existing approvals engine records who and when. */
export async function decideCampaignLaunch(approvalId: unknown, decision: unknown, note?: unknown): Promise<ActionResult<{ decided: true }>> {
  return runAction(async () => {
    const d = z.enum(["approved", "rejected"]).parse(decision);
    await decideApproval(idSchema.parse(approvalId), d, typeof note === "string" ? note : undefined);
    refresh();
    return { decided: true };
  });
}

export async function launchCampaignAction(id: unknown): Promise<ActionResult<LaunchResult>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const cid = idSchema.parse(id);
    const r = await launchCampaign({ workspaceId, userId }, cid);
    refresh(cid);
    return r;
  });
}

const lifecycle = { pause: pauseCampaign, resume: resumeCampaign, cancel: cancelCampaign } as const;

export async function changeCampaignState(id: unknown, action: unknown): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const cid = idSchema.parse(id);
    const a = z.enum(["pause", "resume", "cancel"]).parse(action);
    await lifecycle[a]({ workspaceId, userId }, cid);
    refresh(cid);
    return { ok: true as const };
  });
}

