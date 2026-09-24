"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { mapAiError, runAction, type ActionResult } from "@/lib/api";
import { approveDraft, editDraft, generateDraftForLead, getCurrentDraft, getEditHistory, listDrafts, rejectDraft, type DraftEdit, type DraftListItem, type DraftView } from "@/lib/domain/personalization/drafts";
import { enqueueDraftGeneration, getWorkspaceTone, setWorkspaceTone, type DraftBatchResult } from "@/lib/domain/personalization/service";
import { getResearchProgress, type ResearchProgress } from "@/lib/intelligence/service";
import { DRAFT_STATUSES, TONES, type DraftStatus, type Tone } from "@/lib/domain/personalization/types";

const toneSchema = z.enum(TONES);
const optionsSchema = z.object({ tone: toneSchema.optional(), includeNews: z.boolean().optional() });
const idSchema = z.number().int().positive();
const idList = z.array(idSchema).min(1).max(50);

function refresh(leadId?: number) {
  if (leadId) revalidatePath(`/dashboard/leads/${leadId}`);
  revalidatePath("/dashboard/leads/drafts");
}

/** Generate (or regenerate) one lead's email now. Takes several seconds; the draft is validated before it is stored. */
export async function generateEmailDraft(leadId: unknown, options?: unknown): Promise<ActionResult<DraftView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const id = idSchema.parse(leadId);
    const opts = optionsSchema.parse(options ?? {});
    try {
      const draft = await generateDraftForLead({ workspaceId, userId }, id, opts);
      refresh(id);
      return draft;
    } catch (err) {
      throw mapAiError(err);
    }
  });
}

/** Queue drafts for many leads as background jobs (max 50). */
export async function generateEmailDrafts(leadIds: unknown, options?: unknown): Promise<ActionResult<DraftBatchResult>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const r = await enqueueDraftGeneration({ workspaceId, userId }, idList.parse(leadIds), optionsSchema.parse(options ?? {}));
    refresh();
    return r;
  });
}

export async function getDraftBatchProgressAction(agentRunId: number): Promise<ActionResult<ResearchProgress>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    return getResearchProgress(workspaceId, Number(agentRunId));
  });
}

const editSchema = z.object({ subject: z.string().max(400), body: z.string().max(12000) });

export async function saveDraftEdit(draftId: unknown, input: unknown): Promise<ActionResult<DraftView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const draft = await editDraft({ workspaceId, userId }, idSchema.parse(draftId), editSchema.parse(input));
    refresh(draft.leadId);
    return draft;
  });
}

export async function approveEmailDraft(draftId: unknown): Promise<ActionResult<DraftView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const draft = await approveDraft({ workspaceId, userId }, idSchema.parse(draftId));
    refresh(draft.leadId);
    return draft;
  });
}

export async function rejectEmailDraft(draftId: unknown): Promise<ActionResult<DraftView>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const draft = await rejectDraft({ workspaceId, userId }, idSchema.parse(draftId));
    refresh(draft.leadId);
    return draft;
  });
}

export async function getLeadDraft(leadId: number): Promise<DraftView | null> {
  const { workspaceId } = await requireRole("viewer");
  return getCurrentDraft(workspaceId, Number(leadId));
}

export async function getDraftEdits(draftId: number): Promise<DraftEdit[]> {
  const { workspaceId } = await requireRole("viewer");
  return getEditHistory(workspaceId, Number(draftId));
}

export async function getDraftQueue(filter?: string): Promise<{ items: DraftListItem[]; counts: Record<DraftStatus, number> }> {
  const { workspaceId } = await requireRole("viewer");
  const status = filter === "needs_review" || (DRAFT_STATUSES as readonly string[]).includes(filter ?? "") ? (filter as DraftStatus | "needs_review") : undefined;
  return listDrafts(workspaceId, { status });
}

/** Workspace default tone (admin). Individual generations may override it. */
export async function saveWorkspaceTone(tone: unknown): Promise<ActionResult<{ tone: Tone }>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("admin");
    const t = toneSchema.parse(tone);
    await setWorkspaceTone(workspaceId, t);
    revalidatePath("/dashboard/settings");
    return { tone: t };
  });
}

export async function getTone(): Promise<Tone> {
  const { workspaceId } = await requireRole("viewer");
  return getWorkspaceTone(workspaceId);
}

