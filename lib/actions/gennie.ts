"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { runAction, type ActionResult } from "@/lib/api";
import { kickWorker } from "@/lib/jobs/kick";
import { approveRun, cancelRun, getHome, getRunView, pauseRun, planRun, resumeRun } from "@/lib/domain/gennie/service";
import type { GennieHome, GennieRunView } from "@/lib/domain/gennie/view";

/**
 * Ask Gennie. Planning, approving and controlling a run need `member` (research spends AI budget); viewing is
 * `viewer`. Every id is resolved inside the caller's workspace by the service — a run id from another workspace
 * simply doesn't exist.
 */

export async function planGennieRun(prompt: unknown): Promise<ActionResult<{ runId: number }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    const { runId } = await planRun({ workspaceId, userId }, typeof prompt === "string" ? prompt : "");
    revalidatePath("/dashboard");
    return { runId };
  });
}

export async function approveGennieRun(runId: number): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await approveRun({ workspaceId, userId }, Number(runId));
    revalidatePath("/dashboard");
    return { ok: true as const };
  });
}

export async function cancelGennieRun(runId: number): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await cancelRun({ workspaceId, userId }, Number(runId));
    revalidatePath("/dashboard");
    return { ok: true as const };
  });
}

export async function pauseGennieRun(runId: number): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await pauseRun({ workspaceId, userId }, Number(runId));
    return { ok: true as const };
  });
}

export async function resumeGennieRun(runId: number): Promise<ActionResult<{ ok: true }>> {
  return runAction(async () => {
    const { workspaceId, userId } = await requireRole("member");
    await resumeRun({ workspaceId, userId }, Number(runId));
    return { ok: true as const };
  });
}

/** Polled by the run page. While a run is active, also nudges the worker so progress doesn't wait for the scheduler. */
export async function getGennieRunAction(runId: number): Promise<ActionResult<GennieRunView>> {
  return runAction(async () => {
    const { workspaceId } = await requireRole("viewer");
    const view = await getRunView(workspaceId, Number(runId));
    if (view.status === "running") kickWorker();
    return view;
  });
}

export async function getGennieHomeAction(): Promise<GennieHome> {
  const { workspaceId } = await requireRole("viewer");
  return getHome(workspaceId);
}
