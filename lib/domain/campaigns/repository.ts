import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { isOAuthProvider, mailboxBlockedReason } from "@/lib/domain/mailboxes/types";
import { isTone } from "@/lib/domain/personalization/types";
import {
  audienceDefinitionSchema,
  DEFAULT_AUDIENCE,
  DEFAULT_SEND_WINDOW,
  sendWindowSchema,
  type CampaignRecord,
  type CampaignStatus,
  type CampaignStep,
  type SendModel,
  type StepMode,
} from "./types";

/** All campaign SQL reads live here (repository); services decide, this module fetches. Every query is workspace-scoped. */

const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);

export async function loadSteps(campaignId: number): Promise<CampaignStep[]> {
  const rows = await sql`
    select id, step_order, wait_days, subject, body, mode from campaign_steps where campaign_id = ${campaignId} order by step_order
  `;
  return rows.map((r) => ({
    id: Number(r.id), order: Number(r.step_order), waitDays: Number(r.wait_days), subject: String(r.subject ?? ""), body: String(r.body ?? ""),
    mode: (r.mode === "personalized" ? "personalized" : "template") as StepMode,
  }));
}

export async function loadCampaign(workspaceId: number, campaignId: number): Promise<CampaignRecord> {
  const rows = await sql`select * from campaigns where id = ${campaignId} and workspace_id = ${workspaceId}`;
  const c = rows[0];
  if (!c) throw new AppError("NOT_FOUND", "Campaign not found.");
  const audience = audienceDefinitionSchema.safeParse(c.audience_definition ?? {});
  const window = sendWindowSchema.safeParse(c.send_window ?? DEFAULT_SEND_WINDOW);
  return {
    id: Number(c.id), workspaceId: Number(c.workspace_id), name: String(c.name), status: String(c.status) as CampaignStatus,
    sendModel: String(c.send_model) as SendModel, mailboxId: c.mailbox_id === null ? null : Number(c.mailbox_id),
    fromEmail: (c.from_email as string | null) ?? null, tone: isTone(c.tone) ? c.tone : "concise",
    dailyLimit: Number(c.daily_email_limit), totalLimit: c.total_limit === null ? null : Number(c.total_limit),
    sendWindow: window.success ? window.data : DEFAULT_SEND_WINDOW, audience: audience.success ? audience.data : DEFAULT_AUDIENCE,
    allowTemplateFallback: Boolean(c.allow_template_fallback), approvalId: c.approval_id === null ? null : Number(c.approval_id),
    approvedAt: iso(c.approved_at), startedAt: iso(c.started_at), pausedReason: (c.paused_reason as string | null) ?? null, totalLeads: Number(c.total_leads), blockedCount: Number(c.blocked_count),
    sentCount: Number(c.sent_count), repliedCount: Number(c.replied_count), createdAt: iso(c.created_at)!, steps: await loadSteps(campaignId),
  };
}

/**
 * `verified` means "has whatever domain setup its provider needs": a Resend mailbox needs a verified domain; a Gmail/Microsoft
 * mailbox has no domain of ours, so it is always true. `blockedReason` is the shared rule (lib/domain/mailboxes/types.ts).
 */
export type MailboxInfo = { id: number; email: string; active: boolean; verified: boolean; dailyLimit: number; provider?: string; blockedReason?: string | null };

export async function loadMailbox(workspaceId: number, mailboxId: number | null): Promise<MailboxInfo | null> {
  if (!mailboxId) return null;
  const rows = await sql`
    select m.id, m.email, m.provider, m.status, m.daily_limit, d.status as domain_status
    from mailboxes m left join domains d on d.id = m.domain_id and d.workspace_id = m.workspace_id
    where m.id = ${mailboxId} and m.workspace_id = ${workspaceId}
  `;
  const m = rows[0];
  if (!m) return null;
  const provider = String(m.provider);
  return {
    id: Number(m.id), email: String(m.email), active: m.status === "active", verified: isOAuthProvider(provider) || m.domain_status === "verified", dailyLimit: Number(m.daily_limit),
    provider, blockedReason: mailboxBlockedReason({ provider, status: String(m.status), domainStatus: (m.domain_status as string | null) ?? null }),
  };
}

export type LeadDraft = { leadId: number; draftId: number; status: string; subject: string; body: string };

/** Each lead's CURRENT single-lead draft (Phase 3). Only `approved` ones may be sent. */
export async function loadCurrentDrafts(workspaceId: number, leadIds: number[]): Promise<Map<number, LeadDraft>> {
  if (leadIds.length === 0) return new Map();
  const rows = await sql`
    select id, lead_id, status, subject, body from message_drafts
    where workspace_id = ${workspaceId} and lead_id = any(${leadIds}::bigint[]) and is_current and step_index = 0 and campaign_id is null
  `;
  return new Map(
    rows.map((r) => [Number(r.lead_id), { leadId: Number(r.lead_id), draftId: Number(r.id), status: String(r.status), subject: String(r.subject), body: String(r.body) }]),
  );
}

/** Step ids that have already gone out to at least one lead — their copy is locked. */
export async function loadSentStepIds(workspaceId: number, campaignId: number): Promise<Set<number>> {
  const rows = await sql`
    select distinct step_id from campaign_sends
    where workspace_id = ${workspaceId} and campaign_id = ${campaignId} and status in ('sent', 'queued')
  `;
  return new Set(rows.map((r) => Number(r.step_id)));
}
