"use server";

import { sql } from "@/lib/db/client";
import { draftMessage, draftFromPromptVersion, type Channel } from "@/lib/ai/messages";
import { requireRole } from "@/lib/auth/workspace-context";
import { getPublishedVersionForType } from "@/lib/actions/prompts";
import type { PromptType } from "@/lib/prompts-constants";

const CHANNEL_TO_PROMPT_TYPE: Record<Channel, PromptType> = {
  email: "email",
  linkedin_dm: "linkedin",
};

export async function generateSequenceStepMessage(input: {
  channel: Channel;
  stepIndex: number;
  audienceLabel: string;
  audiencePrompt?: string | null;
  campaignName?: string;
}) {
  const { workspaceId, email: owner, userId } = await requireRole("member");

  const rows = await sql`select company, pitch from users where email = ${owner}`;
  const senderCompany = (rows[0]?.company as string | null) ?? null;
  const senderPitch = (rows[0]?.pitch as string | null) ?? null;

  // Prefer the workspace's own published prompt for this channel over the
  // built-in default — falls back automatically if none is published yet,
  // or if the custom version's output doesn't validate (see draftFromPromptVersion).
  const publishedVersion = await getPublishedVersionForType(workspaceId, CHANNEL_TO_PROMPT_TYPE[input.channel]);

  let draft = publishedVersion
    ? await draftFromPromptVersion(publishedVersion, {
        audienceLabel: input.audienceLabel,
        audiencePrompt: input.audiencePrompt ?? "",
        campaignName: input.campaignName ?? input.audienceLabel,
        stepIndex: String(input.stepIndex),
        senderCompany: senderCompany ?? "",
        senderPitch: senderPitch ?? "",
      })
    : null;

  const usedVersionId = draft ? publishedVersion!.id : null;

  if (!draft) {
    draft = await draftMessage({ ...input, senderCompany, senderPitch });
  }

  // CAM-03: keep the exact prompt/model/inputs behind every generated message,
  // independent of whether it ends up in a launched campaign — and which
  // prompt version (if any) produced it.
  await sql`
    insert into message_generations (
      workspace_id, step_index, channel, model, prompt,
      sender_company, sender_pitch, output_subject, output_body, generated_by_user_id, prompt_version_id
    )
    values (
      ${workspaceId}, ${input.stepIndex}, ${input.channel}, ${draft.model}, ${draft.prompt},
      ${senderCompany}, ${senderPitch}, ${draft.subject ?? null}, ${draft.body}, ${userId}, ${usedVersionId}
    )
  `;

  return { subject: draft.subject, body: draft.body };
}
