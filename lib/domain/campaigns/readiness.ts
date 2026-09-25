import { isOAuthProvider } from "@/lib/domain/mailboxes/types";
import { lintEmailCopy } from "@/lib/domain/personalization/validators";
import { hasSenderIdentity, unknownPlaceholders, type SenderIdentity } from "@/lib/campaigns/render";
import { loadSenderIdentity } from "@/lib/domain/sending/identity";
import { resolveAudience, type AudienceResolution } from "./audience";
import { loadCurrentDrafts, loadMailbox, type LeadDraft, type MailboxInfo } from "./repository";
import type { CampaignRecord } from "./types";

/**
 * "Can this campaign be submitted / launched?" — a checklist, not a boolean. Blockers stop submit-for-approval and
 * launch; warnings are shown but don't stop anything. Each blocker says what to fix and where (`section`).
 */

export type Section = "basics" | "audience" | "sequence" | "personalization" | "review";
export type Check = { section: Section; message: string };

export type DraftSummary = {
  personalized: boolean;
  approved: number;
  needsReview: number;
  failed: number;
  missing: number;
  /** Leads that would be sent the template instead of a personalised draft (only with the explicit fallback opt-in). */
  usingFallback: number;
  blockingLeads: { id: number; name: string; reason: "missing" | "needs_review" | "failed_validation" }[];
};

export type Readiness = {
  blockers: Check[];
  warnings: Check[];
  audience: AudienceResolution;
  mailbox: MailboxInfo | null;
  drafts: DraftSummary;
  /** How many eligible leads will actually be enrolled (after the total limit). */
  willEnroll: number;
  overTotalLimit: number;
};

/** Pure part: turns loaded facts into checks. Unit-tested without a database. */
export function evaluateReadiness(
  c: CampaignRecord,
  facts: { audience: AudienceResolution; mailbox: MailboxInfo | null; drafts: Map<number, LeadDraft>; identity?: SenderIdentity | null },
): Readiness {
  const blockers: Check[] = [];
  const warnings: Check[] = [];
  const { audience, mailbox } = facts;

  // Basics
  if (!c.name.trim()) blockers.push({ section: "basics", message: "Give the campaign a name." });
  if (!mailbox) blockers.push({ section: "basics", message: "Pick a sending mailbox." });
  else {
    if (!mailbox.active || !mailbox.verified) {
      blockers.push({
        section: "basics",
        message: isOAuthProvider(mailbox.provider ?? "") && mailbox.blockedReason
          ? `${mailbox.email} can't send right now. ${mailbox.blockedReason} Fix it in Settings → Mailboxes or pick another mailbox.`
          : `${mailbox.email} isn't active on a verified domain. Fix it in Email Deliverability or pick another mailbox.`,
      });
    }
    if (c.dailyLimit > mailbox.dailyLimit) blockers.push({ section: "basics", message: `The daily limit (${c.dailyLimit}) is higher than ${mailbox.email}'s limit of ${mailbox.dailyLimit}/day.` });
  }
  // Every email must say who sent it and where (CAN-SPAM / GDPR). `undefined` = not checked (pure unit tests); checkReadiness always passes it.
  if (facts.identity !== undefined && !hasSenderIdentity(facts.identity)) {
    blockers.push({ section: "review", message: "Add your sender name and postal address in Settings → Positioning & ICP. Every email carries them in its footer." });
  }
  if (c.dailyLimit < 20) warnings.push({ section: "basics", message: `A daily limit of ${c.dailyLimit} will take a while to reach everyone.` });

  // Sequence
  if (c.steps.length === 0) blockers.push({ section: "sequence", message: "Add at least one step." });
  c.steps.forEach((s) => {
    const label = `Step ${s.order}`;
    const templateNeeded = s.mode === "template" || c.allowTemplateFallback;
    if (s.order === 1 && templateNeeded && !s.subject.trim()) blockers.push({ section: "sequence", message: `${label} needs a subject.` });
    if (templateNeeded && !s.body.trim()) blockers.push({ section: "sequence", message: s.mode === "template" ? `${label} has no message.` : `${label} needs a template to fall back to.` });
    if (s.mode === "personalized" && s.order !== 1) blockers.push({ section: "sequence", message: `${label}: only the first email can be personalised per lead; follow-ups use a template.` });
    for (const p of unknownPlaceholders(`${s.subject}\n${s.body}`)) {
      blockers.push({ section: "sequence", message: `${label} uses ${p}, which can't be filled in. Supported: {{first_name}}, {{company}}.` });
    }
    const text = `${s.order === 1 ? s.subject : ""}\n${s.body}`.replace(/\{\{\s*(first_name|company)\s*\}\}/g, "X");
    for (const i of lintEmailCopy(text)) warnings.push({ section: "sequence", message: `${label}: ${i.message}` });
  });

  // Audience
  const eligible = audience.eligible.length;
  if (eligible === 0) blockers.push({ section: "audience", message: "Nobody in this audience can be emailed. Check the exclusions." });
  if (audience.capped) warnings.push({ section: "audience", message: audience.notes[0] ?? "The audience was capped." });
  const willEnroll = c.totalLimit === null ? eligible : Math.min(eligible, c.totalLimit);
  const overTotalLimit = eligible - willEnroll;
  if (overTotalLimit > 0) warnings.push({ section: "audience", message: `${overTotalLimit} eligible lead(s) are over the total limit of ${c.totalLimit} and won't be enrolled.` });

  // Personalization
  const personalized = c.steps.some((s) => s.mode === "personalized");
  const drafts: DraftSummary = { personalized, approved: 0, needsReview: 0, failed: 0, missing: 0, usingFallback: 0, blockingLeads: [] };
  if (personalized) {
    for (const lead of audience.eligible.slice(0, willEnroll)) {
      const d = facts.drafts.get(lead.id);
      const reason = !d || d.status === "rejected" ? "missing" : d.status === "approved" ? null : d.status === "failed_validation" ? "failed_validation" : "needs_review";
      if (reason === null) drafts.approved++;
      else {
        if (reason === "missing") drafts.missing++;
        else if (reason === "failed_validation") drafts.failed++;
        else drafts.needsReview++;
        if (c.allowTemplateFallback) drafts.usingFallback++;
        else if (drafts.blockingLeads.length < 50) drafts.blockingLeads.push({ id: lead.id, name: lead.fullName, reason });
      }
    }
    const unready = drafts.missing + drafts.needsReview + drafts.failed;
    if (unready > 0 && !c.allowTemplateFallback) {
      blockers.push({
        section: "personalization",
        message: `${unready} lead(s) don't have an approved personalised email yet (${drafts.missing} missing, ${drafts.needsReview} to review, ${drafts.failed} failed checks). Approve them, or turn on the template fallback.`,
      });
    } else if (unready > 0) {
      warnings.push({ section: "personalization", message: `${unready} lead(s) will get the step template instead of a personalised email.` });
    }
  }

  return { blockers, warnings, audience, mailbox, drafts, willEnroll, overTotalLimit };
}

export async function checkReadiness(workspaceId: number, c: CampaignRecord): Promise<Readiness> {
  const [audience, mailbox, identity] = await Promise.all([resolveAudience(workspaceId, c.audience, { excludeCampaignId: c.id }), loadMailbox(workspaceId, c.mailboxId), loadSenderIdentity(workspaceId)]);
  const personalized = c.steps.some((s) => s.mode === "personalized");
  const drafts = personalized ? await loadCurrentDrafts(workspaceId, audience.eligible.map((l) => l.id)) : new Map<number, LeadDraft>();
  return evaluateReadiness(c, { audience, mailbox, drafts, identity });
}
