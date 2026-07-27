"use server";

import { sql } from "@/lib/db/client";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/workspace-context";
import { logActivity } from "@/lib/activity";
import { createApprovalRequest } from "@/lib/approvals-core";
import { generateJson, GeminiError, MODEL_NAME, Type } from "@/lib/ai/gemini";
import type { PromptType } from "@/lib/prompts-constants";

export type VersionStatus = "draft" | "pending_approval" | "published" | "deprecated" | "rejected";

export type SchemaField = { key: string; type: "string" | "number"; required: boolean };

const CAMPAIGN_INPUT_SCHEMA: SchemaField[] = [
  { key: "audienceLabel", type: "string", required: true },
  { key: "senderCompany", type: "string", required: false },
  { key: "senderPitch", type: "string", required: false },
  { key: "campaignName", type: "string", required: false },
  { key: "stepIndex", type: "string", required: false },
];

// Seeded starting point for the two prompt types the campaign wizard actually
// consumes (see lib/actions/ai.ts) — editable, not fixed; a published version
// of this shape is what the wizard's "AI write" button will pick up instead
// of its built-in default.
const SEED_TEMPLATES: Partial<Record<PromptType, { template: string; outputSchema: SchemaField[] }>> = {
  email: {
    template: `You are writing outbound sales copy for a B2B SDR sequence.

You represent {{senderCompany}}. What they sell and why a prospect should care: {{senderPitch}}
Ground every claim in that description — do not invent product features, outcomes, or stats.

Target audience: {{audienceLabel}}
Campaign: {{campaignName}}
This is touchpoint #{{stepIndex}} in the sequence.

Use the literal placeholders {{first_name}} and {{company}} wherever you'd reference the recipient's first name or company — do not invent a specific name or company, the placeholders will be substituted per-recipient later.

Tone: concise, human, not salesy. No corporate buzzwords. A busy exec should read it in under 15 seconds.

Write a cold/follow-up outbound email. Return JSON with "subject" and "body".`,
    outputSchema: [
      { key: "subject", type: "string", required: true },
      { key: "body", type: "string", required: true },
    ],
  },
  linkedin: {
    template: `You are writing a short LinkedIn connection/DM message for a B2B SDR sequence.

You represent {{senderCompany}}. What they sell and why a prospect should care: {{senderPitch}}

Target audience: {{audienceLabel}}
Campaign: {{campaignName}}
This is touchpoint #{{stepIndex}}.

Use the literal placeholders {{first_name}} and {{company}} wherever you'd reference the recipient's first name or company.

Write a short LinkedIn DM (max 300 characters, no subject line). Return JSON with "body".`,
    outputSchema: [{ key: "body", type: "string", required: true }],
  },
};

export type PromptSummary = {
  id: number;
  name: string;
  type: PromptType;
  channel: string | null;
  archived: boolean;
  latestVersion: number | null;
  latestStatus: VersionStatus | null;
  publishedVersion: number | null;
  createdAt: string;
};

export async function listPrompts(): Promise<PromptSummary[]> {
  const { workspaceId } = await requireRole("viewer");
  const rows = await sql`
    select
      p.id, p.name, p.type, p.channel, p.archived, p.created_at,
      (select max(version_number) from prompt_versions where prompt_id = p.id) as latest_version,
      (select status from prompt_versions where prompt_id = p.id order by version_number desc limit 1) as latest_status,
      (select version_number from prompt_versions where prompt_id = p.id and status = 'published' limit 1) as published_version
    from prompts p
    where p.workspace_id = ${workspaceId}
    order by p.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as number,
    name: r.name as string,
    type: r.type as PromptType,
    channel: r.channel as string | null,
    archived: r.archived as boolean,
    latestVersion: r.latest_version as number | null,
    latestStatus: r.latest_status as VersionStatus | null,
    publishedVersion: r.published_version as number | null,
    createdAt: r.created_at as string,
  }));
}

export type PromptVersion = {
  id: number;
  promptId: number;
  versionNumber: number;
  status: VersionStatus;
  template: string;
  inputSchema: SchemaField[];
  outputSchema: SchemaField[];
  toneRules: string | null;
  prohibitedClaims: string | null;
  requiredSources: string | null;
  evalNotes: string | null;
  model: string;
  clonedFromVersionId: number | null;
  lastTestedAt: string | null;
  lastTestPassed: boolean | null;
  lastTestOutput: Record<string, unknown> | null;
  approvalId: number | null;
  publishedAt: string | null;
  deprecatedAt: string | null;
  createdAt: string;
};

function toVersion(r: Record<string, unknown>): PromptVersion {
  return {
    id: r.id as number,
    promptId: r.prompt_id as number,
    versionNumber: r.version_number as number,
    status: r.status as VersionStatus,
    template: r.template as string,
    inputSchema: r.input_schema as SchemaField[],
    outputSchema: r.output_schema as SchemaField[],
    toneRules: r.tone_rules as string | null,
    prohibitedClaims: r.prohibited_claims as string | null,
    requiredSources: r.required_sources as string | null,
    evalNotes: r.eval_notes as string | null,
    model: r.model as string,
    clonedFromVersionId: r.cloned_from_version_id as number | null,
    lastTestedAt: r.last_tested_at as string | null,
    lastTestPassed: r.last_test_passed as boolean | null,
    lastTestOutput: r.last_test_output as Record<string, unknown> | null,
    approvalId: r.approval_id as number | null,
    publishedAt: r.published_at as string | null,
    deprecatedAt: r.deprecated_at as string | null,
    createdAt: r.created_at as string,
  };
}

export async function getPromptDetail(promptId: number): Promise<{
  prompt: { id: number; name: string; type: PromptType; channel: string | null; archived: boolean };
  versions: PromptVersion[];
}> {
  const { workspaceId } = await requireRole("viewer");
  const promptRows = await sql`
    select id, name, type, channel, archived from prompts where id = ${promptId} and workspace_id = ${workspaceId}
  `;
  if (promptRows.length === 0) throw new Error("Prompt not found");

  const versionRows = await sql`
    select * from prompt_versions where prompt_id = ${promptId} and workspace_id = ${workspaceId}
    order by version_number desc
  `;

  return {
    prompt: promptRows[0] as { id: number; name: string; type: PromptType; channel: string | null; archived: boolean },
    versions: versionRows.map(toVersion),
  };
}

/**
 * Used by campaign message generation (lib/actions/ai.ts) to check whether
 * this workspace has a custom published prompt for a channel before falling
 * back to the built-in default. Not workspace-facing UI — just an internal lookup.
 */
export async function getPublishedVersionForType(
  workspaceId: number,
  type: PromptType
): Promise<PromptVersion | null> {
  const rows = await sql`
    select pv.* from prompt_versions pv
    join prompts p on p.id = pv.prompt_id
    where pv.workspace_id = ${workspaceId} and pv.status = 'published'
      and p.type = ${type} and p.archived = false
    order by pv.published_at desc
    limit 1
  `;
  return rows[0] ? toVersion(rows[0]) : null;
}

export async function createPrompt(input: { name: string; type: PromptType; channel?: string }) {
  const { workspaceId, userId } = await requireRole("member");
  if (!input.name.trim()) throw new Error("Prompt needs a name");

  const promptRows = await sql`
    insert into prompts (workspace_id, name, type, channel, created_by_user_id)
    values (${workspaceId}, ${input.name.trim()}, ${input.type}, ${input.channel ?? null}, ${userId})
    returning id
  `;
  const promptId = promptRows[0].id as number;
  const seed = SEED_TEMPLATES[input.type];

  await sql`
    insert into prompt_versions (
      prompt_id, workspace_id, version_number, status, template, input_schema, output_schema, model, created_by_user_id
    )
    values (
      ${promptId}, ${workspaceId}, 1, 'draft', ${seed?.template ?? ""},
      ${JSON.stringify(seed ? CAMPAIGN_INPUT_SCHEMA : [])}, ${JSON.stringify(seed?.outputSchema ?? [])},
      ${MODEL_NAME}, ${userId}
    )
  `;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "prompt.created",
    entityType: "prompt",
    entityId: promptId,
    summary: `Created prompt "${input.name.trim()}" (${input.type})`,
  });

  revalidatePath("/dashboard/ai-prompts");
  return { id: promptId };
}

async function requireDraftVersion(workspaceId: number, versionId: number) {
  const rows = await sql`
    select id, prompt_id, status from prompt_versions where id = ${versionId} and workspace_id = ${workspaceId}
  `;
  const version = rows[0];
  if (!version) throw new Error("Prompt version not found");
  if (version.status !== "draft") {
    throw new Error("This version is no longer a draft — clone it to make further edits (AI-01: published versions are immutable).");
  }
  return version;
}

export type DraftPatch = Partial<{
  template: string;
  inputSchema: SchemaField[];
  outputSchema: SchemaField[];
  toneRules: string | null;
  prohibitedClaims: string | null;
  requiredSources: string | null;
  evalNotes: string | null;
}>;

/** AI-01: only a draft can be edited — published/deprecated/pending versions are immutable. */
export async function updateDraftVersion(versionId: number, patch: DraftPatch) {
  const { workspaceId } = await requireRole("member");
  await requireDraftVersion(workspaceId, versionId);

  await sql`
    update prompt_versions set
      template = coalesce(${patch.template}, template),
      input_schema = coalesce(${patch.inputSchema ? JSON.stringify(patch.inputSchema) : null}::jsonb, input_schema),
      output_schema = coalesce(${patch.outputSchema ? JSON.stringify(patch.outputSchema) : null}::jsonb, output_schema),
      tone_rules = coalesce(${patch.toneRules}, tone_rules),
      prohibited_claims = coalesce(${patch.prohibitedClaims}, prohibited_claims),
      required_sources = coalesce(${patch.requiredSources}, required_sources),
      eval_notes = coalesce(${patch.evalNotes}, eval_notes)
    where id = ${versionId} and workspace_id = ${workspaceId}
  `;
  revalidatePath("/dashboard/ai-prompts");
}

function fieldToGeminiType(f: SchemaField) {
  return f.type === "number" ? Type.NUMBER : Type.STRING;
}

function substitute(template: string, input: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => input[key] ?? `{{${key}}}`);
}

export type TestResult = {
  passed: boolean;
  output: Record<string, unknown> | null;
  errors: string[];
};

/**
 * AI-02: validates the model's output against the version's declared schema
 * and fails safely — a malformed or missing field is reported back as a
 * clear validation error, never a silent pass or an unhandled crash.
 */
export async function testVersion(versionId: number, sampleInput: Record<string, string>): Promise<TestResult> {
  const { workspaceId } = await requireRole("member");

  const rows = await sql`
    select template, output_schema, model from prompt_versions where id = ${versionId} and workspace_id = ${workspaceId}
  `;
  const version = rows[0];
  if (!version) throw new Error("Prompt version not found");

  const outputSchema = version.output_schema as SchemaField[];
  const prompt = substitute(version.template as string, sampleInput);

  let output: Record<string, unknown> | null = null;
  const errors: string[] = [];

  if (outputSchema.length === 0) {
    errors.push("Declare at least one output field before testing.");
  } else {
    const schema = {
      type: Type.OBJECT,
      properties: Object.fromEntries(outputSchema.map((f) => [f.key, { type: fieldToGeminiType(f) }])),
      required: outputSchema.filter((f) => f.required).map((f) => f.key),
    };

    try {
      output = await generateJson<Record<string, unknown>>(prompt, schema);
      for (const field of outputSchema) {
        if (field.required && (output[field.key] === undefined || output[field.key] === null)) {
          errors.push(`Missing required field "${field.key}"`);
          continue;
        }
        if (field.key in output) {
          const actualType = typeof output[field.key];
          const expected = field.type === "number" ? "number" : "string";
          if (actualType !== expected) {
            errors.push(`Field "${field.key}" expected ${expected}, got ${actualType}`);
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof GeminiError ? error.message : "Generation failed unexpectedly");
    }
  }

  const passed = errors.length === 0;

  await sql`
    update prompt_versions
    set last_tested_at = now(), last_test_passed = ${passed}, last_test_output = ${output ? JSON.stringify(output) : null}
    where id = ${versionId} and workspace_id = ${workspaceId}
  `;

  revalidatePath("/dashboard/ai-prompts");
  return { passed, output, errors };
}

/** Only a version that has passed its schema-validated test can be submitted — see AI-02. */
export async function submitForApproval(versionId: number) {
  const { workspaceId, userId } = await requireRole("member");
  const version = await requireDraftVersion(workspaceId, versionId);

  const testedRows = await sql`
    select last_test_passed, p.name as prompt_name, pv.version_number, pv.template, pv.output_schema
    from prompt_versions pv join prompts p on p.id = pv.prompt_id
    where pv.id = ${versionId}
  `;
  const tested = testedRows[0];
  if (!tested.last_test_passed) {
    throw new Error("Run a passing test before submitting this version for approval.");
  }

  const approvalId = await createApprovalRequest({
    workspaceId,
    type: "prompt_publish",
    entityType: "prompt_version",
    entityId: versionId,
    title: `Publish "${tested.prompt_name}" v${tested.version_number}`,
    summary: `${tested.template.length} character template, ${(tested.output_schema as SchemaField[]).length} output field(s)`,
    payload: { promptId: version.prompt_id, versionNumber: tested.version_number },
    requestedByUserId: userId,
  });

  await sql`
    update prompt_versions set status = 'pending_approval', approval_id = ${approvalId} where id = ${versionId}
  `;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "prompt.submitted",
    entityType: "prompt_version",
    entityId: versionId,
    summary: `Submitted "${tested.prompt_name}" v${tested.version_number} for approval`,
  });

  revalidatePath("/dashboard/ai-prompts");
  return { approvalId };
}

export async function deprecateVersion(versionId: number) {
  const { workspaceId, userId } = await requireRole("admin");

  const rows = await sql`
    update prompt_versions set status = 'deprecated', deprecated_at = now()
    where id = ${versionId} and workspace_id = ${workspaceId} and status = 'published'
    returning prompt_id, version_number
  `;
  if (rows.length === 0) throw new Error("Only a published version can be deprecated");

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "prompt.deprecated",
    entityType: "prompt_version",
    entityId: versionId,
    summary: `Deprecated version ${rows[0].version_number}`,
  });

  revalidatePath("/dashboard/ai-prompts");
}

/** Clone is how you "edit" anything past draft — it forks a new draft version from any existing one. */
export async function cloneVersion(versionId: number) {
  const { workspaceId, userId } = await requireRole("member");

  const rows = await sql`select * from prompt_versions where id = ${versionId} and workspace_id = ${workspaceId}`;
  const source = rows[0];
  if (!source) throw new Error("Prompt version not found");

  const maxRows = await sql`
    select coalesce(max(version_number), 0) as max_version from prompt_versions where prompt_id = ${source.prompt_id}
  `;
  const nextVersion = (maxRows[0].max_version as number) + 1;

  const inserted = await sql`
    insert into prompt_versions (
      prompt_id, workspace_id, version_number, status, template, input_schema, output_schema,
      tone_rules, prohibited_claims, required_sources, eval_notes, model, cloned_from_version_id, created_by_user_id
    )
    values (
      ${source.prompt_id}, ${workspaceId}, ${nextVersion}, 'draft', ${source.template},
      ${JSON.stringify(source.input_schema)}, ${JSON.stringify(source.output_schema)}, ${source.tone_rules}, ${source.prohibited_claims},
      ${source.required_sources}, ${source.eval_notes}, ${source.model}, ${versionId}, ${userId}
    )
    returning id
  `;

  await logActivity({
    workspaceId,
    actorUserId: userId,
    type: "prompt.cloned",
    entityType: "prompt_version",
    entityId: inserted[0].id as number,
    summary: `Cloned version ${source.version_number} into new draft v${nextVersion}`,
  });

  revalidatePath("/dashboard/ai-prompts");
  return { id: inserted[0].id as number, versionNumber: nextVersion };
}
