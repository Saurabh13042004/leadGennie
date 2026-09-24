"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { AppError, runAction, type ActionResult } from "@/lib/api";
import { icpSchema } from "@/lib/domain/workspace/icp";
import { getIntelligenceClient } from "@/lib/intelligence/client";
import { toEngineIcp } from "@/lib/intelligence/icp";
import { getLeadIntelligence, type LeadIntelligence } from "@/lib/intelligence/read-model";
import {
  cancelResearch,
  enqueueLeadResearch,
  enqueueRescoreLead,
  getResearchProgress,
  type EnqueueResult,
  type ResearchProgress,
} from "@/lib/intelligence/service";

const idList = z.array(z.number().int().positive()).min(1).max(200);

/** Research one or many leads (member+). Returns immediately; the work runs as background jobs. */
export async function researchLeads(leadIds: unknown): Promise<ActionResult<EnqueueResult>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const ids = idList.parse(leadIds);
    const result = await enqueueLeadResearch({ workspaceId, userId }, ids);
    for (const id of ids.slice(0, 50)) revalidatePath(`/dashboard/leads/${id}`);
    revalidatePath("/dashboard/leads");
    return result;
  });
}

export async function getResearchProgressAction(agentRunId: number): Promise<ActionResult<ResearchProgress>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    return getResearchProgress(workspaceId, Number(agentRunId));
  });
}

export async function cancelResearchAction(agentRunId: number): Promise<ActionResult<{ canceled: number }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const r = await cancelResearch({ workspaceId, userId }, Number(agentRunId));
    revalidatePath("/dashboard/leads");
    return r;
  });
}

export async function rescoreLead(leadId: number): Promise<ActionResult<{ enqueued: boolean }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const r = await enqueueRescoreLead({ workspaceId, userId }, Number(leadId));
    revalidatePath(`/dashboard/leads/${leadId}`);
    return r;
  });
}

export async function getIntelligence(leadId: number): Promise<LeadIntelligence | null> {
  const { workspaceId } = await requireRole("viewer");
  return getLeadIntelligence(workspaceId, Number(leadId));
}

const sampleSchema = z.object({
  industry: z.string().trim().max(120).nullable().default(null),
  country: z.string().trim().max(120).nullable().default(null),
  employeeCount: z.number().int().min(0).max(10_000_000).nullable().default(null),
  title: z.string().trim().max(200).nullable().default(null),
  keywordsFound: z.array(z.string().trim().max(80)).max(20).default([]),
});

export type IcpTestResult = {
  icpScore: number;
  confidence: number;
  qualified: boolean;
  breakdown: { criterion: string; status: string; weight: number; points: number; valueFound: string | null }[];
  whyFit: { criterion: string; status: string; text: string }[];
};

/**
 * "Test against a sample lead" in the ICP editor: scores made-up attributes against the (possibly UNSAVED) ICP so
 * the effect of a change is visible before it is saved. Pure engine call — no research, no LLM, nothing stored.
 */
export async function testIcpAgainstSample(input: { icp: unknown; sample: unknown }): Promise<ActionResult<IcpTestResult>> {
  return runAction(async () => {
    await requireRole("member");
    const icp = icpSchema.parse(input.icp);
    const s = sampleSchema.parse(input.sample);
    const score = await getIntelligenceClient().score({
      icp: toEngineIcp(icp),
      company: { industry: s.industry, country: s.country, employee_count: s.employeeCount, keywords_found: s.keywordsFound },
      person: s.title ? { title: s.title } : null,
      signals: [],
    });
    if (!score) throw new AppError("PROVIDER_ERROR", "The research engine returned no score.");
    return {
      icpScore: score.icp.score,
      confidence: score.icp.confidence,
      qualified: score.qualified,
      breakdown: score.icp.breakdown.map((b) => ({ criterion: b.criterion, status: b.status, weight: b.weight, points: b.points, valueFound: b.value_found ?? null })),
      whyFit: score.why_fit.map((w) => ({ criterion: w.criterion, status: w.status, text: w.text })),
    };
  });
}
