import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { appBaseUrl, renderStep, unsubscribeFooter } from "@/lib/campaigns/render";
import { isEmailConfigured, sendCampaignEmail } from "@/lib/email/resend";
import { lintEmailCopy } from "@/lib/domain/personalization/validators";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { resolveAudience } from "./audience";
import { loadCampaign, loadCurrentDrafts, loadMailbox } from "./repository";
import { planSchedule } from "./schedule";
import { EXCLUSION_LABEL, type ExclusionReason } from "./types";
import type { Actor } from "./service";

/**
 * "Exactly what this lead will receive": the same renderer, the same unsubscribe footer and the same scheduler the
 * launch and the sender use. After launch, the preview shows the real materialised sends (their stored text and time).
 */

export type PreviewStep = {
  order: number;
  subject: string;
  body: string;
  footer: string;
  /** When it goes out: the real scheduled time after launch; an estimate before. */
  sendAt: string | null;
  sendAtIsEstimate: boolean;
  source: "draft" | "template" | "sent";
  status: string | null;
  warnings: string[];
};

export type CampaignPreview = {
  lead: { id: number; name: string; email: string | null; company: string | null };
  from: string | null;
  /** Why this lead won't receive the campaign (null = they will). */
  excludedBecause: string | null;
  /** Personalized step without an approved draft and no fallback: nothing to preview for that step. */
  missingDraft: boolean;
  steps: PreviewStep[];
};

export async function previewForLead(workspaceId: number, campaignId: number, leadId: number): Promise<CampaignPreview> {
  const c = await loadCampaign(workspaceId, campaignId);
  const leadRows = await sql`
    select l.id, l.full_name, l.email, coalesce(co.name, l.company) as company
    from leads l left join companies co on co.id = l.company_id and co.workspace_id = l.workspace_id
    where l.id = ${leadId} and l.workspace_id = ${workspaceId}`;
  const l = leadRows[0];
  if (!l) throw new AppError("NOT_FOUND", "Lead not found.");
  const lead = { id: Number(l.id), name: String(l.full_name), email: (l.email as string | null) ?? null, company: (l.company as string | null) ?? null };
  const mailbox = await loadMailbox(workspaceId, c.mailboxId);
  const footer = lead.email ? unsubscribeFooter(buildUnsubscribeUrl(appBaseUrl(), workspaceId, lead.email)) : "";

  // After launch: show the real, stored sends.
  const sent = await sql`
    select cs.subject, cs.body, cs.scheduled_at, cs.status, cs.message_draft_id, st.step_order, cl.status as lead_status, cl.stop_reason
    from campaign_sends cs join campaign_steps st on st.id = cs.step_id
    left join campaign_leads cl on cl.id = cs.campaign_lead_id
    where cs.workspace_id = ${workspaceId} and cs.campaign_id = ${campaignId} and cs.lead_id = ${leadId} order by st.step_order`;
  if (sent.length > 0) {
    return {
      lead, from: c.fromEmail, excludedBecause: sent[0].lead_status === "blocked" || sent[0].lead_status === "stopped" ? String(sent[0].stop_reason ?? "Stopped") : null, missingDraft: false,
      steps: sent.map((s) => ({
        order: Number(s.step_order), subject: String(s.subject ?? ""), body: String(s.body), footer,
        sendAt: new Date(String(s.scheduled_at)).toISOString(), sendAtIsEstimate: false,
        source: s.message_draft_id ? "draft" : s.status === "sent" ? "sent" : "template", status: String(s.status), warnings: [],
      })),
    };
  }

  // Before launch: render from the templates/drafts and estimate timing for a lone lead launched now.
  const resolution = await resolveAudience(workspaceId, { ...c.audience, source: "leads", leadIds: [leadId] }, { excludeCampaignId: campaignId });
  const reason = Object.entries(resolution.exclusions).find(([, n]) => n > 0)?.[0] as ExclusionReason | undefined;
  const inAudience = await isInAudience(workspaceId, c, leadId);
  const drafts = await loadCurrentDrafts(workspaceId, [leadId]);
  const d = drafts.get(leadId);
  const approvedDraft = d && d.status === "approved" ? { id: d.draftId, subject: d.subject, body: d.body } : null;
  const plan = planSchedule({ leadCount: 1, waitDays: c.steps.map((s) => s.waitDays), window: c.sendWindow, dailyLimit: c.dailyLimit, now: new Date() });
  let missingDraft = false;
  const steps: PreviewStep[] = [];
  c.steps.forEach((s, i) => {
    const out = renderStep(s, c.steps[0], { fullName: lead.name, company: lead.company }, approvedDraft, { allowTemplateFallback: c.allowTemplateFallback });
    if (!out) {
      missingDraft = true;
      return;
    }
    const lint = out.source === "template" ? lintEmailCopy(`${i === 0 ? out.subject : ""}\n${out.body}`) : [];
    steps.push({
      order: s.order, subject: out.subject, body: out.body, footer, sendAt: plan.sends[i]?.at.toISOString() ?? null, sendAtIsEstimate: true,
      source: out.source, status: null, warnings: lint.map((x) => x.message),
    });
  });
  return {
    lead, from: mailbox?.email ?? c.fromEmail,
    excludedBecause: reason ? EXCLUSION_LABEL[reason] : inAudience ? null : "Not in this campaign's audience",
    missingDraft, steps,
  };
}

async function isInAudience(workspaceId: number, c: Awaited<ReturnType<typeof loadCampaign>>, leadId: number): Promise<boolean> {
  if (c.audience.source === "all") return true;
  if (c.audience.source === "leads") return c.audience.leadIds.includes(leadId);
  const r = await resolveAudience(workspaceId, { ...c.audience, filters: { ...c.audience.filters, minIcpScore: null, requireResearched: false, qualifiedOnly: false, includeRiskyEmails: true } }, { excludeCampaignId: c.id });
  return r.candidates > 0 && (r.eligible.some((l) => l.id === leadId) || Object.values(r.excludedIds).some((ids) => ids?.includes(leadId)));
}

/** Leads to offer in the preview picker: the audience's eligible leads first, then a few excluded ones. */
export async function previewCandidates(workspaceId: number, campaignId: number): Promise<{ id: number; name: string; excluded: string | null }[]> {
  const c = await loadCampaign(workspaceId, campaignId);
  const r = await resolveAudience(workspaceId, c.audience, { excludeCampaignId: campaignId });
  const out: { id: number; name: string; excluded: string | null }[] = r.eligible.slice(0, 50).map((l) => ({ id: l.id, name: l.fullName, excluded: null }));
  for (const [reason, list] of Object.entries(r.samples)) {
    for (const s of list ?? []) out.push({ id: s.id, name: s.name, excluded: EXCLUSION_LABEL[reason as ExclusionReason] });
  }
  return out;
}

/** Sends one step, exactly as rendered for `leadId`, to the signed-in user's own address. Never to the lead. */
export async function sendTestEmail(actor: Actor & { userId: number }, campaignId: number, leadId: number, stepOrder: number): Promise<{ to: string }> {
  if (!isEmailConfigured()) throw new AppError("NOT_CONFIGURED", "Email sending isn't configured (RESEND_API_KEY).");
  const preview = await previewForLead(actor.workspaceId, campaignId, leadId);
  const step = preview.steps.find((s) => s.order === stepOrder);
  if (!step) throw new AppError("NOT_FOUND", "That step has nothing to send for this lead.");
  if (!preview.from) throw new AppError("VALIDATION_ERROR", "Pick a sending mailbox first.");
  const mailbox = await loadMailbox(actor.workspaceId, (await loadCampaign(actor.workspaceId, campaignId)).mailboxId);
  if (!mailbox || !mailbox.active || !mailbox.verified) throw new AppError("VALIDATION_ERROR", "The sending mailbox isn't active on a verified domain.");
  const [u] = await sql`select email from users where id = ${actor.userId}`;
  if (!u?.email) throw new AppError("NOT_FOUND", "Your account has no email address.");
  await sendCampaignEmail({ to: String(u.email), from: mailbox.email, subject: `[Test] ${step.subject}`, body: `${step.body}${step.footer}` });
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.test_sent", entityType: "campaign", entityId: campaignId,
    summary: `Sent a test of step ${stepOrder} (as ${preview.lead.name}) to ${u.email}`,
  });
  return { to: String(u.email) };
}

