import { sql } from "@/lib/db/client";
import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { createApprovalRequest } from "@/lib/approvals-core";
import { renderStep } from "@/lib/campaigns/render";
import { checkReadiness, type Readiness } from "./readiness";
import { loadCampaign, loadCurrentDrafts } from "./repository";
import { planSchedule } from "./schedule";
import { assertTransition } from "./state-machine";
import type { Actor } from "./service";
import { EXCLUSION_LABEL, type CampaignRecord, type ExclusionReason } from "./types";

/**
 * Lifecycle (WP4.1b): submit → (owner/admin decides via the approvals engine) → launch → pause/resume/cancel.
 * Launch is impossible without an APPROVED approval row for this exact campaign; that row carries who approved and
 * when. Launch enrolls only leads the approver saw (snapshot ∩ still eligible today) — never someone new.
 */

const blockerError = (r: Readiness) =>
  new AppError("CONFLICT", `This campaign isn't ready: ${r.blockers[0].message}${r.blockers.length > 1 ? ` (+${r.blockers.length - 1} more)` : ""}`, r.blockers.map((b) => ({ path: b.section, message: b.message })));

export type ApprovalPayload = {
  kind: "builder";
  audienceLabel: string;
  totalLeads: number;
  blockedCount: number;
  exclusions: Partial<Record<ExclusionReason, number>>;
  /** Eligible lead ids the approver saw. Launch never enrolls anyone outside this list. */
  leadIds: number[];
  steps: { order: number; waitDays: number; mode: string; subject: string }[];
  fromEmail: string | null;
  dailyLimit: number;
  totalLimit: number | null;
  sendWindow: CampaignRecord["sendWindow"];
  sampleMessage: { leadName: string; subject: string; body: string } | null;
  warnings: string[];
  channels: string[];
};

export async function submitForApproval(actor: Actor, id: number): Promise<{ approvalId: number; readiness: Readiness }> {
  const c = await loadCampaign(actor.workspaceId, id);
  if (c.sendModel !== "leads") throw new AppError("CONFLICT", "Only builder campaigns can be submitted here.");
  assertTransition(c.status, "pending_approval");
  const r = await checkReadiness(actor.workspaceId, c);
  if (r.blockers.length > 0) throw blockerError(r);

  const enrolled = r.audience.eligible.slice(0, r.willEnroll);
  const drafts = await loadCurrentDrafts(actor.workspaceId, enrolled.slice(0, 1).map((l) => l.id));
  const sampleLead = enrolled[0];
  const sample = sampleLead && c.steps[0]
    ? renderStep(c.steps[0], c.steps[0], { fullName: sampleLead.fullName, company: sampleLead.company },
        drafts.get(sampleLead.id)?.status === "approved" ? { id: drafts.get(sampleLead.id)!.draftId, subject: drafts.get(sampleLead.id)!.subject, body: drafts.get(sampleLead.id)!.body } : null,
        { allowTemplateFallback: true })
    : null;
  const exclusions = Object.fromEntries(Object.entries(r.audience.exclusions).filter(([, n]) => n > 0)) as ApprovalPayload["exclusions"];
  const blockedCount = Object.values(exclusions).reduce((n, v) => n + (v ?? 0), 0);
  const payload: ApprovalPayload = {
    kind: "builder", audienceLabel: c.audience.source === "segment" ? "Saved segment" : c.audience.source === "leads" ? "Selected leads" : "All leads",
    totalLeads: enrolled.length, blockedCount, exclusions, leadIds: enrolled.map((l) => l.id),
    steps: c.steps.map((s) => ({ order: s.order, waitDays: s.waitDays, mode: s.mode, subject: s.subject })),
    fromEmail: r.mailbox?.email ?? null, dailyLimit: c.dailyLimit, totalLimit: c.totalLimit, sendWindow: c.sendWindow,
    sampleMessage: sample ? { leadName: sampleLead.fullName, subject: sample.subject, body: sample.body } : null,
    warnings: r.warnings.map((w) => w.message), channels: ["email"],
  };
  const approvalId = await createApprovalRequest({
    workspaceId: actor.workspaceId, type: "campaign_launch", entityType: "campaign", entityId: id,
    title: `Launch "${c.name}"`,
    summary: `${enrolled.length} lead${enrolled.length === 1 ? "" : "s"}, ${c.steps.length} email step${c.steps.length === 1 ? "" : "s"}, from ${payload.fromEmail}${blockedCount > 0 ? ` — ${blockedCount} excluded` : ""}`,
    payload, requestedByUserId: actor.userId,
  });
  const moved = await sql`
    update campaigns set status = 'pending_approval', approval_id = ${approvalId}, total_leads = ${enrolled.length}, blocked_count = ${blockedCount}, updated_at = now()
    where id = ${id} and workspace_id = ${actor.workspaceId} and status = ${c.status} returning id`;
  if (moved.length === 0) throw new AppError("CONFLICT", "The campaign changed while submitting. Reload and try again.");
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.launch_requested", entityType: "campaign", entityId: id, summary: `Requested approval to launch "${c.name}" to ${enrolled.length} leads` });
  return { approvalId, readiness: r };
}

/**
 * Called by `decideApproval` for builder campaigns. Acts only if the campaign is still waiting on THIS approval, so a
 * stale or duplicate decision can't move a campaign.
 */
export async function applyLaunchDecision(workspaceId: number, userId: number, approvalId: number, campaignId: number, decision: "approved" | "rejected"): Promise<void> {
  const next = decision === "approved" ? "ready" : "rejected";
  const moved = await sql`
    update campaigns set status = ${next}, approved_at = ${decision === "approved" ? new Date().toISOString() : null}, updated_at = now()
    where id = ${campaignId} and workspace_id = ${workspaceId} and status = 'pending_approval' and approval_id = ${approvalId}
    returning name`;
  if (moved.length === 0) return;
  await logActivity({
    workspaceId, actorUserId: userId, type: decision === "approved" ? "approval.approved" : "approval.rejected", entityType: "campaign", entityId: campaignId,
    summary: decision === "approved" ? `Approved "${moved[0].name}" — ready to launch` : `Rejected launch of "${moved[0].name}"`,
  });
}

export type LaunchResult = { enrolled: number; excluded: number; overLimit: number; firstSendAt: string | null; lastSendAt: string | null };

export async function launchCampaign(actor: Actor, id: number, now: Date = new Date()): Promise<LaunchResult> {
  const c = await loadCampaign(actor.workspaceId, id);
  if (c.sendModel !== "leads") throw new AppError("CONFLICT", "Only builder campaigns are launched here.");
  assertTransition(c.status, "running");
  const approval = c.approvalId
    ? (await sql`select status, payload from approvals where id = ${c.approvalId} and workspace_id = ${actor.workspaceId} and entity_type = 'campaign' and entity_id = ${id} and type = 'campaign_launch'`)[0]
    : undefined;
  if (!approval || approval.status !== "approved") throw new AppError("FORBIDDEN", "This campaign hasn't been approved. An owner or admin must approve it before it can launch.");

  const r = await checkReadiness(actor.workspaceId, c);
  if (r.blockers.length > 0) throw blockerError(r);

  // Only people the approver saw, and only if they are still eligible today (someone may have unsubscribed since).
  const approved = new Set(((approval.payload as ApprovalPayload).leadIds ?? []).map(Number));
  const eligible = r.audience.eligible.filter((l) => approved.has(l.id));
  const enrolled = eligible.slice(0, c.totalLimit ?? eligible.length);
  const overLimit = eligible.length - enrolled.length;
  if (enrolled.length === 0) throw new AppError("CONFLICT", "None of the approved leads can be emailed any more. Edit the audience and resubmit.");

  // Claim the launch first: a double click or a concurrent launch loses here and changes nothing.
  const claimed = await sql`
    update campaigns set status = 'running', started_at = ${now.toISOString()}, updated_at = now()
    where id = ${id} and workspace_id = ${actor.workspaceId} and status = 'ready' returning id`;
  if (claimed.length === 0) throw new AppError("CONFLICT", "This campaign is already launching or was changed. Reload the page.");

  try {
    const drafts = await loadCurrentDrafts(actor.workspaceId, enrolled.map((l) => l.id));
    const plan = planSchedule({ leadCount: enrolled.length, waitDays: c.steps.map((s) => s.waitDays), window: c.sendWindow, dailyLimit: c.dailyLimit, now });
    const clIds = (await sql`select nextval(pg_get_serial_sequence('campaign_leads', 'id')) as id from generate_series(1, ${enrolled.length})`).map((x) => Number(x.id));

    const sends = plan.sends.map((p) => {
      const lead = enrolled[p.leadIndex];
      const d = drafts.get(lead.id);
      const approvedDraft = d && d.status === "approved" ? { id: d.draftId, subject: d.subject, body: d.body } : null;
      const out = renderStep(c.steps[p.stepIndex], c.steps[0], { fullName: lead.fullName, company: lead.company }, approvedDraft, { allowTemplateFallback: c.allowTemplateFallback });
      if (!out) throw new AppError("CONFLICT", `${lead.fullName} has no approved personalised email.`);
      return { clId: clIds[p.leadIndex], leadId: lead.id, stepId: c.steps[p.stepIndex].id, at: p.at.toISOString(), subject: out.subject, body: out.body, draftId: out.draftId };
    });

    // Excluded candidates are recorded too (status 'blocked' + reason) so the per-lead table shows everyone.
    const excluded = exclusionRows(r, new Set(enrolled.map((l) => l.id)), approved);
    await sql.transaction([
      sql.query(
        `insert into campaign_leads (id, workspace_id, campaign_id, lead_id, status, next_action_at)
         select x.id, $1, $2, x.lead_id, 'active', x.at from unnest($3::bigint[], $4::bigint[], $5::timestamptz[]) as x(id, lead_id, at)
         on conflict (campaign_id, lead_id) do nothing`,
        [actor.workspaceId, id, clIds, enrolled.map((l) => l.id), plan.firstSendAt.map((d) => d.toISOString())],
      ),
      sql.query(
        `insert into campaign_leads (workspace_id, campaign_id, lead_id, status, stop_reason, completed_at)
         select $1, $2, x.lead_id, x.status, x.reason, now() from unnest($3::bigint[], $4::text[], $5::text[]) as x(lead_id, status, reason)
         on conflict (campaign_id, lead_id) do nothing`,
        [actor.workspaceId, id, excluded.map((e) => e.leadId), excluded.map((e) => e.status), excluded.map((e) => e.reason)],
      ),
      sql.query(
        `insert into campaign_sends (workspace_id, campaign_id, lead_id, step_id, channel, status, scheduled_at, subject, body, campaign_lead_id, message_draft_id)
         select $1, $2, x.lead_id, x.step_id, 'email', 'pending', x.at, x.subject, x.body, x.cl_id, x.draft_id
         from unnest($3::bigint[], $4::bigint[], $5::timestamptz[], $6::text[], $7::text[], $8::bigint[], $9::bigint[])
           as x(lead_id, step_id, at, subject, body, cl_id, draft_id)
         on conflict do nothing`,
        [actor.workspaceId, id, sends.map((s) => s.leadId), sends.map((s) => s.stepId), sends.map((s) => s.at), sends.map((s) => s.subject), sends.map((s) => s.body), sends.map((s) => s.clId), sends.map((s) => s.draftId)],
      ),
      sql`update campaigns set total_leads = ${enrolled.length}, blocked_count = ${excluded.length} where id = ${id} and workspace_id = ${actor.workspaceId}`,
    ]);
    await logActivity({
      workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.launched", entityType: "campaign", entityId: id,
      summary: `Launched "${c.name}" — ${enrolled.length} lead(s) enrolled, first send ${plan.firstSendAt[0]?.toISOString() ?? "—"}`,
      metadata: { enrolled: enrolled.length, excluded: excluded.length, overLimit },
    });
    return {
      enrolled: enrolled.length, excluded: excluded.length, overLimit,
      firstSendAt: plan.firstSendAt[0]?.toISOString() ?? null, lastSendAt: plan.lastSendAt?.toISOString() ?? null,
    };
  } catch (err) {
    // Nothing was committed (single transaction) — put the campaign back so it can be launched again.
    await sql`update campaigns set status = 'ready', started_at = null where id = ${id} and workspace_id = ${actor.workspaceId} and status = 'running'
              and not exists (select 1 from campaign_leads where campaign_id = ${id})`;
    throw err;
  }
}

/** Everyone considered but not enrolled, with the reason — shown in the per-lead table instead of vanishing. */
function exclusionRows(r: Readiness, enrolled: Set<number>, approved: Set<number>) {
  const out: { leadId: number; status: string; reason: string }[] = [];
  for (const l of r.audience.eligible) {
    if (enrolled.has(l.id)) continue;
    out.push({ leadId: l.id, status: "stopped", reason: approved.has(l.id) ? "Over the campaign's total limit" : "Not in the approved audience" });
  }
  for (const [reason, ids] of Object.entries(r.audience.excludedIds)) {
    for (const leadId of ids ?? []) out.push({ leadId, status: "blocked", reason: EXCLUSION_LABEL[reason as ExclusionReason] });
  }
  return out;
}

// ---- pause / resume / cancel ----------------------------------------------------------------------------------------

export async function pauseCampaign(actor: Actor, id: number): Promise<void> {
  const c = await loadCampaign(actor.workspaceId, id);
  assertTransition(c.status, "paused");
  const moved = await sql`update campaigns set status = 'paused', paused_at = now(), updated_at = now() where id = ${id} and workspace_id = ${actor.workspaceId} and status = 'running' returning id`;
  if (moved.length === 0) throw new AppError("CONFLICT", "The campaign isn't running any more. Reload the page.");
  // Reflected per lead: nobody has a next action while paused.
  await sql`update campaign_leads set next_action_at = null where campaign_id = ${id} and workspace_id = ${actor.workspaceId} and status = 'active'`;
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.paused", entityType: "campaign", entityId: id, summary: `Paused "${c.name}"` });
}

/**
 * Resuming shifts every pending send by the paused duration (rounded up to whole days, so each day keeps the same
 * number of sends and the daily limit still holds) — otherwise every overdue email would go out in one burst.
 */
export async function resumeCampaign(actor: Actor, id: number): Promise<void> {
  const c = await loadCampaign(actor.workspaceId, id);
  assertTransition(c.status, "running");
  if (c.status !== "paused") throw new AppError("CONFLICT", "Only a paused campaign can be resumed.");
  const [row] = await sql`select paused_at from campaigns where id = ${id} and workspace_id = ${actor.workspaceId}`;
  const pausedAt = row?.paused_at ? new Date(String(row.paused_at)) : new Date();
  const moved = await sql`
    update campaigns set status = 'running', updated_at = now(), paused_at = null where id = ${id} and workspace_id = ${actor.workspaceId} and status = 'paused' returning id`;
  if (moved.length === 0) throw new AppError("CONFLICT", "The campaign isn't paused any more. Reload the page.");
  const shiftDays = Math.max(0, Math.ceil((Date.now() - pausedAt.getTime()) / 86_400_000));
  await sql.transaction([
    sql`update campaign_sends set scheduled_at = scheduled_at + make_interval(days => ${shiftDays})
        where campaign_id = ${id} and workspace_id = ${actor.workspaceId} and status = 'pending'`,
    sql`update campaign_leads cl set next_action_at = (select min(scheduled_at) from campaign_sends s where s.campaign_lead_id = cl.id and s.status = 'pending')
        where cl.campaign_id = ${id} and cl.workspace_id = ${actor.workspaceId} and cl.status = 'active'`,
  ]);
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.resumed", entityType: "campaign", entityId: id, summary: `Resumed "${c.name}" (pending sends moved ${shiftDays} day(s) later)` });
}

export async function cancelCampaign(actor: Actor, id: number): Promise<void> {
  const c = await loadCampaign(actor.workspaceId, id);
  assertTransition(c.status, "canceled");
  const moved = await sql`update campaigns set status = 'canceled', completed_at = now(), updated_at = now() where id = ${id} and workspace_id = ${actor.workspaceId} and status = ${c.status} returning id`;
  if (moved.length === 0) throw new AppError("CONFLICT", "The campaign changed. Reload the page.");
  await sql.transaction([
    sql`update campaign_sends set status = 'canceled', error_message = 'Campaign canceled' where campaign_id = ${id} and workspace_id = ${actor.workspaceId} and status = 'pending'`,
    sql`update campaign_leads set status = 'stopped', stop_reason = 'Campaign canceled', next_action_at = null, completed_at = now()
        where campaign_id = ${id} and workspace_id = ${actor.workspaceId} and status in ('pending', 'active')`,
    // A request still waiting for a decision is closed, so nobody approves a campaign that no longer exists.
    sql`update approvals set status = 'rejected', decided_by_user_id = ${actor.userId}, decided_at = now(), decision_note = 'Campaign canceled'
        where workspace_id = ${actor.workspaceId} and entity_type = 'campaign' and entity_id = ${id} and status = 'pending'`,
  ]);
  await logActivity({ workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "campaign.canceled", entityType: "campaign", entityId: id, summary: `Canceled "${c.name}"` });
}
