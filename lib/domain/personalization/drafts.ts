import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { MODEL_NAME } from "@/lib/ai/client";
import { createAgentRun, finishAgentRun } from "@/lib/domain/agent-runs/service";
import { recordUsage } from "@/lib/domain/usage/record";
import { loadContext } from "./context";
import { generateFromContext } from "./generate";
import { PROMPT_VERSION, type LibraryRules } from "./prompt";
import {
  DRAFT_STATUSES,
  isTone,
  type DraftClaim,
  type DraftStatus,
  type PersonalizationContext,
  type Tone,
  type ValidationIssue,
} from "./types";
import { hasErrors, validateDraft, validateEdit } from "./validators";

/**
 * Persistence + lifecycle of message drafts (spec WP3.3). THE single writer of message_drafts.
 *
 *   generate → draft (clean)  | failed_validation (a validator error survived the one regeneration)
 *   edit     → edited         (re-validated; problems are WARNINGS — a person owns their words — and are logged)
 *   approve  → approved       (never for failed_validation; a clean draft is re-checked against today's evidence)
 *   reject   → rejected
 *
 * Nothing here sends anything. Regenerating keeps history: the previous draft stays (is_current = false).
 */

export type Actor = { workspaceId: number; userId: number | null };

export type EvidenceRef = { id: number; claim: string; snippet: string; sourceUrl: string; sourceTitle: string | null; capturedAt: string };

export type DraftView = {
  id: number;
  leadId: number;
  leadName: string;
  company: string | null;
  stepIndex: number;
  status: DraftStatus;
  subject: string;
  body: string;
  originalSubject: string;
  originalBody: string;
  angle: string;
  tone: Tone;
  includeNews: boolean;
  claims: DraftClaim[];
  issues: ValidationIssue[];
  attempts: number;
  confidence: number | null;
  model: string;
  promptVersion: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  isCurrent: boolean;
  /** Evidence rows the highlights link to, keyed by id (workspace-scoped lookup). */
  evidence: Record<number, EvidenceRef>;
  /** Context notes shown to the user ("news left out because the toggle is off"). Only present right after generation. */
  notes?: string[];
};

const asIssues = (v: unknown): ValidationIssue[] => (Array.isArray(v) ? (v as ValidationIssue[]) : []);
const asClaims = (v: unknown): DraftClaim[] =>
  (Array.isArray(v) ? (v as { text: string; evidence_id: number }[]) : []).map((c) => ({ text: c.text, evidenceId: Number(c.evidence_id) }));

async function evidenceFor(workspaceId: number, ids: number[]): Promise<Record<number, EvidenceRef>> {
  if (ids.length === 0) return {};
  const rows = await sql`
    select id, claim, snippet, source_url, source_title, captured_at from evidence
    where workspace_id = ${workspaceId} and id = any(${ids}::bigint[])
  `;
  return Object.fromEntries(
    rows.map((e) => [
      Number(e.id),
      { id: Number(e.id), claim: String(e.claim), snippet: String(e.snippet), sourceUrl: String(e.source_url), sourceTitle: (e.source_title as string | null) ?? null, capturedAt: new Date(String(e.captured_at)).toISOString() },
    ]),
  );
}

async function toViews(workspaceId: number, rows: Record<string, unknown>[]): Promise<DraftView[]> {
  const ids = [...new Set(rows.flatMap((r) => asClaims(r.claims).map((c) => c.evidenceId)))];
  const evidence = await evidenceFor(workspaceId, ids);
  return rows.map((r) => {
    const claims = asClaims(r.claims);
    return {
      id: Number(r.id), leadId: Number(r.lead_id), leadName: String(r.lead_name ?? ""), company: (r.lead_company as string | null) ?? null,
      stepIndex: Number(r.step_index), status: String(r.status) as DraftStatus, subject: String(r.subject), body: String(r.body),
      originalSubject: String(r.original_subject), originalBody: String(r.original_body), angle: String(r.angle),
      tone: isTone(r.tone) ? r.tone : "concise", includeNews: Boolean(r.include_news), claims, issues: asIssues(r.issues),
      attempts: Number(r.attempts), confidence: r.confidence === null ? null : Number(r.confidence), model: String(r.model),
      promptVersion: String(r.prompt_version), createdAt: new Date(String(r.created_at)).toISOString(),
      updatedAt: new Date(String(r.updated_at)).toISOString(), approvedAt: r.approved_at ? new Date(String(r.approved_at)).toISOString() : null,
      isCurrent: Boolean(r.is_current),
      evidence: Object.fromEntries(claims.filter((c) => evidence[c.evidenceId]).map((c) => [c.evidenceId, evidence[c.evidenceId]])),
    };
  });
}

export async function getDraft(workspaceId: number, draftId: number): Promise<DraftView | null> {
  const rows = await sql`
    select d.*, l.full_name as lead_name, l.company as lead_company
    from message_drafts d join leads l on l.id = d.lead_id and l.workspace_id = d.workspace_id
    where d.workspace_id = ${workspaceId} and d.id = ${draftId}
  `;
  return (await toViews(workspaceId, rows))[0] ?? null;
}

export async function getCurrentDraft(workspaceId: number, leadId: number): Promise<DraftView | null> {
  const rows = await sql`
    select d.*, l.full_name as lead_name, l.company as lead_company
    from message_drafts d join leads l on l.id = d.lead_id and l.workspace_id = d.workspace_id
    where d.workspace_id = ${workspaceId} and d.lead_id = ${leadId} and d.is_current and d.step_index = 0 and d.campaign_id is null
  `;
  return (await toViews(workspaceId, rows))[0] ?? null;
}

export type DraftListItem = {
  id: number; leadId: number; leadName: string; company: string | null; status: DraftStatus; subject: string;
  errorCount: number; warningCount: number; updatedAt: string; tone: Tone;
};

export async function listDrafts(
  workspaceId: number,
  opts: { status?: DraftStatus | "needs_review"; limit?: number; offset?: number } = {},
): Promise<{ items: DraftListItem[]; counts: Record<DraftStatus, number> }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  // "needs review" = generated or edited but not yet approved/rejected.
  const statuses: DraftStatus[] = opts.status === "needs_review" ? ["draft", "edited"] : opts.status ? [opts.status] : [...DRAFT_STATUSES];
  const [rows, countRows] = await Promise.all([
    sql`
      select d.id, d.lead_id, d.status, d.subject, d.issues, d.updated_at, d.tone, l.full_name as lead_name, l.company as lead_company
      from message_drafts d join leads l on l.id = d.lead_id and l.workspace_id = d.workspace_id
      where d.workspace_id = ${workspaceId} and d.is_current and d.status = any(${statuses}::text[])
      order by d.updated_at desc, d.id desc limit ${limit} offset ${offset}
    `,
    sql`select status, count(*)::int as n from message_drafts where workspace_id = ${workspaceId} and is_current group by status`,
  ]);
  const counts = Object.fromEntries(DRAFT_STATUSES.map((s) => [s, 0])) as Record<DraftStatus, number>;
  for (const c of countRows) counts[String(c.status) as DraftStatus] = Number(c.n);
  return {
    counts,
    items: rows.map((r) => {
      const issues = asIssues(r.issues);
      return {
        id: Number(r.id), leadId: Number(r.lead_id), leadName: String(r.lead_name), company: (r.lead_company as string | null) ?? null,
        status: String(r.status) as DraftStatus, subject: String(r.subject), errorCount: issues.filter((i) => i.severity === "error").length,
        warningCount: issues.filter((i) => i.severity === "warning").length, updatedAt: new Date(String(r.updated_at)).toISOString(),
        tone: isTone(r.tone) ? r.tone : "concise",
      };
    }),
  };
}

// ---- generation ---------------------------------------------------------------------------------------------

async function libraryRules(workspaceId: number): Promise<LibraryRules> {
  const rows = await sql`
    select pv.id, pv.tone_rules, pv.prohibited_claims from prompt_versions pv
    join prompts p on p.id = pv.prompt_id
    where pv.workspace_id = ${workspaceId} and pv.status = 'published' and p.type = 'email' and p.archived = false
    order by pv.published_at desc limit 1
  `;
  const r = rows[0];
  return r ? { versionId: Number(r.id), toneRules: (r.tone_rules as string | null) ?? null, prohibitedClaims: (r.prohibited_claims as string | null) ?? null } : {};
}

export type GenerateOptions = { tone?: Tone; includeNews?: boolean; agentRunId?: number | null };

/**
 * Generates and stores a draft for one lead. A provider failure (`LlmError`) propagates and stores nothing;
 * a draft that cannot pass validation is stored as `failed_validation` with the reasons — never silently
 * replaced by something unchecked.
 */
export async function generateDraftForLead(actor: Actor, leadId: number, opts: GenerateOptions = {}): Promise<DraftView> {
  const ctx = await loadContext(actor.workspaceId, actor.userId, leadId, { tone: opts.tone, includeNews: opts.includeNews });
  const library = await libraryRules(actor.workspaceId);
  const ownRun = opts.agentRunId === undefined || opts.agentRunId === null;
  const runId = ownRun ? await createAgentRun({ workspaceId: actor.workspaceId, userId: actor.userId, type: "personalize_lead", input: { leadId, tone: ctx.tone, includeNews: ctx.includeNews } }) : (opts.agentRunId as number);

  let result;
  try {
    result = await generateFromContext(ctx, library);
  } catch (err) {
    if (ownRun) await finishAgentRun(actor.workspaceId, runId, { status: "failed", error: err instanceof Error ? err.message : "failed" }).catch(() => undefined);
    throw err;
  }
  const { output, issues, passed } = result;
  const model = result.usage[0]?.model ?? MODEL_NAME;
  const tokensIn = result.usage.reduce((n, u) => n + u.tokensIn, 0);
  const tokensOut = result.usage.reduce((n, u) => n + u.tokensOut, 0);

  const [gen, idRows, researchRows] = await Promise.all([
    sql`
      insert into message_generations (workspace_id, step_index, channel, model, prompt, sender_company, sender_pitch, output_subject, output_body, generated_by_user_id, prompt_version_id)
      values (${actor.workspaceId}, 0, 'email', ${model}, ${result.prompt}, ${ctx.sender.company}, ${ctx.sender.positioning || null}, ${output.subject}, ${output.body}, ${actor.userId}, ${library.versionId ?? null})
      returning id`,
    sql`select nextval(pg_get_serial_sequence('message_drafts', 'id')) as id`,
    sql`select id from lead_research where lead_id = ${leadId} and workspace_id = ${actor.workspaceId} and is_current`,
  ]);
  const draftId = Number(idRows[0].id);
  const claims = output.personalized_claims;
  const usedIds = [...new Set([...output.used_evidence_ids, ...claims.map((c) => c.evidence_id)])].filter((id) => ctx.evidence.some((e) => e.id === id));

  await sql.transaction([
    sql`update message_drafts set is_current = false, updated_at = now()
        where workspace_id = ${actor.workspaceId} and lead_id = ${leadId} and step_index = 0 and campaign_id is null and is_current`,
    sql`insert into message_drafts (
          id, workspace_id, lead_id, step_index, status, subject, body, original_subject, original_body, angle, tone, include_news,
          used_evidence_ids, claims, issues, attempts, confidence, prompt_version, prompt_version_id, model, tokens_in, tokens_out,
          generation_id, research_id, agent_run_id, created_by_user_id
        ) values (
          ${draftId}, ${actor.workspaceId}, ${leadId}, 0, ${passed ? "draft" : "failed_validation"}, ${output.subject}, ${output.body}, ${output.subject}, ${output.body},
          ${output.angle}, ${ctx.tone}, ${ctx.includeNews}, ${usedIds}::bigint[], ${JSON.stringify(claims)}, ${JSON.stringify(issues)}, ${result.attempts},
          ${output.confidence}, ${PROMPT_VERSION}, ${library.versionId ?? null}, ${model}, ${tokensIn}, ${tokensOut},
          ${Number(gen[0].id)}, ${researchRows[0] ? Number(researchRows[0].id) : null}, ${runId}, ${actor.userId}
        )`,
  ]);

  await recordUsage(
    { workspaceId: actor.workspaceId, userId: actor.userId },
    result.usage.map((u) => ({ kind: "llm" as const, provider: "openai", model: u.model, tokensIn: u.tokensIn, tokensOut: u.tokensOut })),
    { type: "message_draft", id: draftId, agentRunId: runId },
  ).catch(() => undefined);
  if (ownRun) {
    await finishAgentRun(actor.workspaceId, runId, { status: "completed", output: { draftId, passed, attempts: result.attempts }, tokensUsed: tokensIn + tokensOut });
  }
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: passed ? "draft.generated" : "draft.failed_validation", entityType: "lead", entityId: leadId,
    summary: passed ? "Generated an email draft" : "Generated an email draft that failed validation", metadata: { draftId, attempts: result.attempts, errors: issues.filter((i) => i.severity === "error").length },
  });

  const view = (await getDraft(actor.workspaceId, draftId))!;
  return { ...view, notes: ctx.notes };
}

// ---- edit / approve / reject ------------------------------------------------------------------------------

const editInput = (subject: string, body: string) => {
  const s = subject.trim();
  const b = body.replace(/\r\n/g, "\n").trim();
  if (!s) throw new AppError("VALIDATION_ERROR", "The subject can't be empty.");
  if (!b) throw new AppError("VALIDATION_ERROR", "The body can't be empty.");
  if (s.length > 200 || b.length > 8000) throw new AppError("VALIDATION_ERROR", "That email is too long.");
  return { s, b };
};

async function loadOwned(workspaceId: number, draftId: number) {
  const rows = await sql`select * from message_drafts where id = ${draftId} and workspace_id = ${workspaceId}`;
  if (rows.length === 0) throw new AppError("NOT_FOUND", "Draft not found.");
  return rows[0];
}

/** Validates against TODAY'S verified evidence for the lead (which may have changed since generation). */
async function contextFor(workspaceId: number, userId: number | null, d: Record<string, unknown>): Promise<PersonalizationContext> {
  return loadContext(workspaceId, userId, Number(d.lead_id), { tone: isTone(d.tone) ? d.tone : undefined, includeNews: Boolean(d.include_news) });
}

export async function editDraft(actor: Actor, draftId: number, input: { subject: string; body: string }): Promise<DraftView> {
  const { s, b } = editInput(input.subject, input.body);
  const d = await loadOwned(actor.workspaceId, draftId);
  if (!d.is_current) throw new AppError("CONFLICT", "This draft was replaced by a newer one. Open the latest draft to edit it.");
  const ctx = await contextFor(actor.workspaceId, actor.userId, d);
  const claims = asClaims(d.claims).map((c) => ({ text: c.text, evidence_id: c.evidenceId }));
  const issues = validateEdit({ subject: s, body: b, claims, usedEvidenceIds: claims.map((c) => c.evidence_id) }, ctx);
  // Keep highlights only for phrases that survive the edit.
  const lowered = `${s}\n${b}`.toLowerCase().replace(/\s+/g, " ");
  const kept = claims.filter((c) => lowered.includes(c.text.toLowerCase().replace(/\s+/g, " ")));

  await sql.transaction([
    sql`insert into message_draft_edits (workspace_id, draft_id, edited_by_user_id, before_subject, before_body, after_subject, after_body, issues)
        values (${actor.workspaceId}, ${draftId}, ${actor.userId}, ${String(d.subject)}, ${String(d.body)}, ${s}, ${b}, ${JSON.stringify(issues)})`,
    sql`update message_drafts set subject = ${s}, body = ${b}, status = 'edited', claims = ${JSON.stringify(kept)}, issues = ${JSON.stringify(issues)},
          used_evidence_ids = ${kept.map((c) => c.evidence_id)}::bigint[], edited_by_user_id = ${actor.userId}, approved_by_user_id = null, approved_at = null, updated_at = now()
        where id = ${draftId} and workspace_id = ${actor.workspaceId}`,
  ]);
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "draft.edited", entityType: "lead", entityId: Number(d.lead_id),
    summary: issues.length > 0 ? `Edited an email draft (${issues.length} warning${issues.length === 1 ? "" : "s"})` : "Edited an email draft",
    metadata: { draftId, warnings: issues.map((i) => i.code) },
  });
  return (await getDraft(actor.workspaceId, draftId))!;
}

export async function approveDraft(actor: Actor, draftId: number): Promise<DraftView> {
  const d = await loadOwned(actor.workspaceId, draftId);
  if (!d.is_current) throw new AppError("CONFLICT", "This draft was replaced by a newer one.");
  const status = String(d.status);
  if (status === "approved") return (await getDraft(actor.workspaceId, draftId))!;
  if (status === "failed_validation") throw new AppError("VALIDATION_ERROR", "This draft broke the evidence rules. Edit it (or regenerate) before approving.");
  if (status === "rejected") throw new AppError("CONFLICT", "This draft was rejected. Regenerate to get a new one.");
  if (status === "draft") {
    // A clean draft is only as good as the evidence it was checked against: re-check before it becomes approved.
    const ctx = await contextFor(actor.workspaceId, actor.userId, d);
    const claims = asClaims(d.claims).map((c) => ({ text: c.text, evidence_id: c.evidenceId }));
    const issues = validateDraft({ subject: String(d.subject), body: String(d.body), claims, usedEvidenceIds: claims.map((c) => c.evidence_id) }, ctx);
    if (hasErrors(issues)) {
      await sql`update message_drafts set status = 'failed_validation', issues = ${JSON.stringify(issues)}, updated_at = now() where id = ${draftId} and workspace_id = ${actor.workspaceId}`;
      throw new AppError("CONFLICT", "The evidence behind this draft changed since it was written, so it no longer passes the checks. Regenerate it.");
    }
  }
  await sql`update message_drafts set status = 'approved', approved_by_user_id = ${actor.userId}, approved_at = now(), updated_at = now() where id = ${draftId} and workspace_id = ${actor.workspaceId}`;
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "draft.approved", entityType: "lead", entityId: Number(d.lead_id), summary: "Approved an email draft", metadata: { draftId, edited: status === "edited" } });
  return (await getDraft(actor.workspaceId, draftId))!;
}

export async function rejectDraft(actor: Actor, draftId: number): Promise<DraftView> {
  const d = await loadOwned(actor.workspaceId, draftId);
  await sql`update message_drafts set status = 'rejected', approved_by_user_id = null, approved_at = null, updated_at = now() where id = ${draftId} and workspace_id = ${actor.workspaceId}`;
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "draft.rejected", entityType: "lead", entityId: Number(d.lead_id), summary: "Rejected an email draft", metadata: { draftId } });
  return (await getDraft(actor.workspaceId, draftId))!;
}

export type DraftEdit = { id: number; at: string; beforeSubject: string; beforeBody: string; afterSubject: string; afterBody: string; issues: ValidationIssue[] };

export async function getEditHistory(workspaceId: number, draftId: number): Promise<DraftEdit[]> {
  const rows = await sql`
    select id, created_at, before_subject, before_body, after_subject, after_body, issues from message_draft_edits
    where workspace_id = ${workspaceId} and draft_id = ${draftId} order by id desc limit 50
  `;
  return rows.map((r) => ({
    id: Number(r.id), at: new Date(String(r.created_at)).toISOString(), beforeSubject: String(r.before_subject), beforeBody: String(r.before_body),
    afterSubject: String(r.after_subject), afterBody: String(r.after_body), issues: asIssues(r.issues),
  }));
}
