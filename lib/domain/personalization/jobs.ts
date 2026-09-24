import { LlmError } from "@/lib/ai/llm-types";
import { AppError } from "@/lib/api/errors";
import { registerJobHandler } from "@/lib/jobs/registry";
import { JobError, PermanentJobError, type HandlerOutcome, type JobContext } from "@/lib/jobs/types";
import { generateDraftForLead } from "./drafts";
import { isTone } from "./types";

/**
 * One job = one lead's draft. Failures stay per-lead: a lead that can't be drafted dead-letters on its own
 * (visible in the batch's error list) while the rest of the batch carries on.
 */
export async function personalizationHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const leadId = Number(ctx.job.payload.leadId);
  if (!Number.isInteger(leadId)) throw new PermanentJobError("Invalid job payload.");
  const tone = isTone(ctx.job.payload.tone) ? ctx.job.payload.tone : undefined;
  const includeNews = ctx.job.payload.includeNews === true;
  try {
    const draft = await generateDraftForLead({ workspaceId: ctx.workspaceId, userId: ctx.userId }, leadId, { tone, includeNews, agentRunId: ctx.job.agentRunId });
    return { kind: "done", result: { draftId: draft.id, status: draft.status } };
  } catch (err) {
    if (err instanceof LlmError) {
      // Quota / bad key never fix themselves; rate limits and provider blips do.
      if (/quota exceeded|not set|invalid or revoked/i.test(err.message)) throw new PermanentJobError(err.message);
      throw new JobError(err.message, { retryable: true });
    }
    if (err instanceof AppError) throw new PermanentJobError(err.message);
    throw err;
  }
}

registerJobHandler("personalization", personalizationHandler);
