import "@/lib/domain/mailboxes/register";
import { sql } from "@/lib/db/client";
import { personalize } from "@/lib/campaigns/personalize";
import { appBaseUrl, hasSenderIdentity, withUnsubscribeFooter } from "@/lib/campaigns/render";
import { getLeadsInCooldown, isOnDoNotContact } from "@/lib/compliance";
import { localDayStart } from "@/lib/domain/campaigns/schedule";
import { markMailboxError } from "@/lib/domain/mailboxes/lifecycle";
import { resolveMailboxProvider } from "@/lib/domain/mailboxes/registry";
import { isOAuthProvider, PROVIDER_LABEL, type MailboxProviderKey } from "@/lib/domain/mailboxes/types";
import type { MailboxProvider } from "@/lib/email/mailbox-provider";
import { isSystemic, toProviderError, type MailProviderError } from "@/lib/email/provider";
import { JobError, type HandlerOutcome, type JobContext } from "@/lib/jobs/types";
import { buildUnsubscribeUrl } from "@/lib/unsubscribe";
import { claimMessage, loadGateCounts } from "./claim";
import { now as clockNow } from "./clock";
import { OUTAGE_FAILURE_THRESHOLD, pauseCampaignBySystem, recentProviderFailures } from "./failures";
import { evaluateGate, gateConfigFromEnv, type GateDecision } from "./gate";
import { complianceHeaders, loadSenderIdentity } from "./identity";
import { markLeadSentStmt, settleCampaignStmt, shiftNextStepStmt, stopLead } from "./lead-state";
import { loadMessageForSend, loadSendContext, type MessageRow, type SendContext } from "./send-context";

/**
 * The `campaign_send` job (WP5.2): sends ONE scheduled email. Idempotent by construction and at-most-once by design.
 *
 *   load → guard → reconcile any earlier attempt → precheck (suppression) → gate (limits/window/spacing)
 *        → CLAIM (insert the message BEFORE calling the provider) → provider.send(idempotency key) → finalize (one transaction)
 *
 * Crash windows, and what covers each:
 *  · dies before the claim         → nothing happened; the retry starts over.
 *  · dies after the claim, before/during the provider call, or after it but before finalize
 *                                  → the message row exists as `sending`. The retry re-sends the STORED payload with the SAME
 *                                    idempotency key; the provider answers with the original id and sends nothing new
 *                                    (Resend keeps keys 24 h). Past ~20 h we no longer trust the key: the email is flagged
 *                                    `failed / unknown_outcome` for a person — a missed email over a duplicate.
 *  · a double-delivered job        → the claim's `on conflict (campaign_send_id)` inserts nothing; the second run just reconciles.
 *
 * Providers WITHOUT an idempotency key (Gmail, Microsoft Graph) can't be replayed safely, so the same guarantee comes from a
 * write-ahead marker instead: `messages.dispatched_at` is set just BEFORE the provider call. A retry that finds it already set
 * cannot tell whether the earlier attempt went out, so the email is flagged `failed / unknown_outcome` for a person — never
 * re-sent. The marker is cleared again only when the provider's answer proves nothing was sent (429, auth, …).
 */

/** Idempotency keys live 24 h at the provider; stop trusting a replay well before that. */
export const IDEMPOTENCY_TRUST_MS = 20 * 3_600_000;
const done = (result: Record<string, unknown>): HandlerOutcome => ({ kind: "done", result });
const waitUntil = (until: Date, from: Date, state: Record<string, unknown> = {}): HandlerOutcome => ({
  kind: "wait", afterSeconds: Math.max(1, Math.ceil((until.getTime() - from.getTime()) / 1000)), state,
});

/** Test-only seam: simulates the process dying right after the provider accepted the email. Never set in production. */
export const sendingTestHooks: { afterProviderSend?: () => void | Promise<void> } = {};

export async function campaignSendHandler(ctx: JobContext): Promise<HandlerOutcome> {
  const sendId = Number(ctx.job.payload.campaignSendId);
  const now = clockNow();
  const s = await loadSendContext(ctx.workspaceId, sendId);
  if (!s) return done({ skipped: "not_found" });

  // Guards: the world may have changed since this job was queued (paused, canceled, lead stopped, already sent).
  if (s.sendStatus !== "pending") return done({ skipped: `send_${s.sendStatus}` });
  if (s.campaignStatus !== "running") return done({ released: `campaign_${s.campaignStatus}` }); // the scheduler re-queues it once the campaign runs again
  if (s.campaignLeadId !== null && s.leadSequenceStatus !== "active") return done({ skipped: `lead_${s.leadSequenceStatus}` });
  if (s.scheduledAt.getTime() > now.getTime()) return waitUntil(s.scheduledAt, now); // shifted later (resume, follow-up delay)

  const existing = await loadMessageForSend(ctx.workspaceId, sendId);
  if (existing) {
    if (["sent", "delivered", "bounced", "complained"].includes(existing.status)) {
      await finalizeSent(s, existing, existing.providerMessageId, null, now);
      return done({ reconciled: "already_sent" });
    }
    if (existing.status === "sending") return sendClaimed(ctx, s, existing, now);
    // failed/canceled (an operator retry, or a released claim): retire it and start a fresh attempt.
    await sql`update messages set campaign_send_id = null, status = 'canceled', error = coalesce(error, '') || ' (superseded by a retry)', updated_at = now()
              where id = ${existing.id} and workspace_id = ${ctx.workspaceId} and status in ('failed', 'canceled')`;
  }

  // ---- prechecks: who/what may never be emailed, and is the sending setup still healthy -------------------------------
  const stop = await suppressionReason(s);
  if (stop) return stopSend(s, stop);
  if (!s.mailboxId || !s.mailboxEmail || s.mailboxBlockedReason) {
    await pauseCampaignBySystem(s.workspaceId, s.campaignId, unavailableMailboxReason(s));
    return done({ released: "mailbox_inactive" });
  }
  // Nothing could ever be sent (no API key / no OAuth client on this server): stop before claiming a message — a claim with no possible send would sit `sending`.
  const provider = providerFor(s);
  if (!provider.isConfigured()) {
    await pauseCampaignBySystem(s.workspaceId, s.campaignId, isOAuthProvider(s.mailboxProvider)
      ? `${PROVIDER_LABEL[s.mailboxProvider as MailboxProviderKey]} sign-in isn't configured on this server, so mailbox ${s.mailboxEmail} can't send. Add the credentials, then resume.`
      : "Email sending isn't configured on this server (no provider API key). Add it, then resume.");
    return done({ released: "provider_not_configured" });
  }
  const identity = await loadSenderIdentity(s.workspaceId);
  if (s.sendModel === "leads" && !hasSenderIdentity(identity)) {
    await pauseCampaignBySystem(s.workspaceId, s.campaignId, "Your sender name and postal address are missing, and every email must carry them. Add them in Settings, then resume.");
    return done({ released: "sender_identity_missing" });
  }

  // ---- gate: limits, window, spacing ---------------------------------------------------------------------------------
  const domain = (s.leadEmail as string).split("@")[1].toLowerCase();
  const tz = s.window?.timezone ?? "UTC";
  const campaignDayStart = localDayStart(now, tz);
  const utcDayStart = localDayStart(now, "UTC");
  const counts = await loadGateCounts({ workspaceId: s.workspaceId, campaignId: s.campaignId, mailboxId: s.mailboxId, recipientDomain: domain, campaignDayStart, utcDayStart, now });
  const decision: GateDecision = evaluateGate({
    now, window: s.window, campaignTimezone: tz, campaignDailyLimit: s.campaignDailyLimit, mailboxDailyLimit: s.mailboxDailyLimit,
    mailboxCreatedAt: s.mailboxCreatedAt, workspaceDailyCap: s.workspaceDailyCap, recipientDomain: domain, counts, seed: s.sendId, config: gateConfigFromEnv(),
  });
  if (decision.kind === "defer") return waitUntil(decision.until, now, { deferred: decision.reason });

  // ---- render the final message (what is stored is exactly what is sent) ----------------------------------------------
  const lead = { full_name: s.leadName, company: s.leadCompany };
  const unsubscribeUrl = buildUnsubscribeUrl(appBaseUrl(), s.workspaceId, s.leadEmail as string);
  const subject = personalize(s.subject, lead);
  const body = withUnsubscribeFooter(personalize(s.body, lead), unsubscribeUrl, identity);

  const messageId = await claimMessage({
    workspaceId: s.workspaceId, campaignId: s.campaignId, campaignLeadId: s.campaignLeadId, sendId: s.sendId, leadId: s.leadId, mailboxId: s.mailboxId, provider: s.mailboxProvider,
    subject, body, headers: complianceHeaders(unsubscribeUrl), fromEmail: s.mailboxEmail, toEmail: (s.leadEmail as string).toLowerCase(), toDomain: domain,
    idempotencyKey: `campaign-send-${s.workspaceId}-${s.sendId}`, now, limits: decision.limits, campaignDayStart, utcDayStart,
  });
  // A cap filled between the gate's read and the claim (another worker took the slot), or a concurrent claim: look again shortly.
  if (messageId === null) return waitUntil(new Date(now.getTime() + 15_000), now, { deferred: "claim_contended" });

  const claimed = await loadMessageForSend(s.workspaceId, s.sendId);
  return sendClaimed(ctx, s, claimed as MessageRow, now);
}

/** Calls the provider for a message that already exists (fresh claim OR reconciling an earlier attempt) and records the outcome. */
async function sendClaimed(ctx: JobContext, s: SendContext, m: MessageRow, now: Date): Promise<HandlerOutcome> {
  // Reconcile rule: an unfinished message older than the idempotency window may or may not have gone out, and the provider can no
  // longer tell us. At-most-once: do not risk a duplicate — flag it for a person.
  if (now.getTime() - m.claimedAt.getTime() > IDEMPOTENCY_TRUST_MS) {
    await failMessage(s, m, "Outcome unknown after a crash or long outage; not resent to avoid a duplicate. Check the provider dashboard, then retry or skip.", "unknown_outcome", now);
    return done({ failed: "unknown_outcome" });
  }
  if (!s.mailboxId || !s.mailboxEmail) {
    await failMessage(s, m, "The sending mailbox was removed before this email went out.", "permanent", now);
    return done({ failed: "mailbox_removed" });
  }

  const provider = providerFor(s);
  const replayable = provider.capabilities.idempotencyKey;
  if (!replayable && !(await markDispatched(s.workspaceId, m.id))) {
    await failMessage(s, m, UNKNOWN_OUTCOME, "unknown_outcome", now);
    return done({ failed: "unknown_outcome" });
  }

  let sent;
  try {
    sent = await provider.send({
      from: m.fromEmail, to: m.toEmail, subject: m.subject, text: m.body, headers: m.headers, idempotencyKey: m.idempotencyKey,
      tags: [{ name: "campaign_send_id", value: String(s.sendId) }],
    });
  } catch (e) {
    const err = toProviderError(e);
    // Without an idempotency key every failure EXCEPT `unknown_outcome` means "nothing was sent" (provider contract), so the marker can go.
    if (!replayable && err.cls !== "unknown_outcome") await clearDispatched(s.workspaceId, m.id);
    return onProviderError(ctx, s, m, err, now);
  }
  await sendingTestHooks.afterProviderSend?.();
  await finalizeSent(s, m, sent.id, sent.threadId ?? null, now);
  return done({ sent: true, providerId: sent.id });
}

const UNKNOWN_OUTCOME =
  "The provider didn't confirm whether this email was sent (the connection dropped mid-send). It was not resent, to avoid a duplicate — check the mailbox's Sent folder, then retry or skip.";

/** Resolves the adapter for the mailbox this send goes through. The pipeline never names a provider — it asks the registry. */
function providerFor(s: SendContext): MailboxProvider {
  return resolveMailboxProvider(s.mailboxProvider, {
    workspaceId: s.workspaceId, mailboxId: s.mailboxId ?? 0, email: s.mailboxEmail ?? "", displayName: s.mailboxDisplayName, scopes: s.mailboxScopes,
  });
}

/** What to tell the user when the campaign's mailbox can't send. The Resend wording predates OAuth mailboxes and is asserted in tests. */
function unavailableMailboxReason(s: SendContext): string {
  if (!isOAuthProvider(s.mailboxProvider) || !s.mailboxId) return "The sending mailbox is no longer active on a verified domain. Fix it in Email Deliverability, then resume.";
  return `${s.mailboxBlockedReason} Fix ${s.mailboxEmail} in Settings → Mailboxes, then resume.`;
}

/** Write-ahead marker: true only for the ONE caller that flips it — a second caller (a retry after a crash) gets false and must not send. */
async function markDispatched(workspaceId: number, messageId: number): Promise<boolean> {
  const rows = await sql`update messages set dispatched_at = now(), updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId} and status = 'sending' and dispatched_at is null returning id`;
  return rows.length > 0;
}

async function clearDispatched(workspaceId: number, messageId: number): Promise<void> {
  await sql`update messages set dispatched_at = null, updated_at = now() where id = ${messageId} and workspace_id = ${workspaceId} and status = 'sending'`;
}

async function onProviderError(ctx: JobContext, s: SendContext, m: MessageRow, err: MailProviderError, now: Date): Promise<HandlerOutcome> {
  const finalAttempt = ctx.job.attempts + 1 >= ctx.job.maxAttempts;

  if (err.cls === "unknown_outcome") {
    // Connection lost or 5xx on a provider with no idempotency key: it may have gone out. Never retry — a person decides (retry / skip).
    await failMessage(s, m, UNKNOWN_OUTCOME, "unknown_outcome", now);
    return done({ failed: "unknown_outcome" });
  }
  if (isSystemic(err.cls)) {
    // The provider rejected the request itself (bad key / unverified domain / dead sign-in), so nothing was sent: release the claim and stop the campaign.
    await sql`update messages set status = 'canceled', campaign_send_id = null, error = ${err.message.slice(0, 1000)}, error_class = ${err.cls}, failed_at = ${now.toISOString()}::timestamptz, updated_at = now()
              where id = ${m.id} and workspace_id = ${s.workspaceId} and status = 'sending'`;
    await pauseCampaignBySystem(s.workspaceId, s.campaignId, await systemicReason(s, err));
    return done({ paused: err.cls });
  }
  if (err.cls === "permanent") {
    await failMessage(s, m, err.message, "permanent", now);
    return done({ failed: "permanent" });
  }

  // retryable / rate_limited / quota — record the attempt and try again with backoff.
  await sql`update messages set attempts = attempts + 1, error = ${err.message.slice(0, 1000)}, error_class = ${err.cls}, updated_at = now() where id = ${m.id} and workspace_id = ${s.workspaceId}`;
  if (!finalAttempt) throw new JobError(err.message, { retryable: true, retryAfterSeconds: err.retryAfterSeconds });

  if (err.code === "network_error") {
    // We never got an answer, so we can't know whether it was sent. Keep the message `sending` and look again later: replaying the
    // same idempotency key is safe until the window closes, after which sendClaimed() flags it instead of resending.
    return waitUntil(new Date(now.getTime() + 15 * 60_000), now, { deferred: "provider_unreachable" });
  }
  await failMessage(s, m, `Provider kept failing: ${err.message}`, err.cls, now);
  if ((await recentProviderFailures(s.workspaceId, s.campaignId, new Date(now.getTime() - 30 * 60_000))) >= OUTAGE_FAILURE_THRESHOLD) {
    await pauseCampaignBySystem(s.workspaceId, s.campaignId, `Sending is failing repeatedly (${err.message}). It looks like a provider problem — resume once it's fixed.`);
  }
  return done({ failed: "retries_exhausted" });
}

/** The sentence a user sees on a campaign the system paused. For an OAuth mailbox the fix is reconnecting or the server's sign-in settings, not an API key. */
async function systemicReason(s: SendContext, err: MailProviderError): Promise<string> {
  if (!isOAuthProvider(s.mailboxProvider) || !s.mailboxId) {
    const why = err.cls === "auth" ? "The email provider rejected our credentials (API key)" : "The email provider rejected the sending domain";
    return `${why}: ${err.message}. Fix it, then resume.`;
  }
  const label = PROVIDER_LABEL[s.mailboxProvider as MailboxProviderKey];
  if (err.cls === "auth") {
    // The token source already flipped the mailbox to reconnect_required when the grant was revoked; this also covers a revoked permission (403).
    return `Your ${label} mailbox ${s.mailboxEmail} needs to be reconnected before LeadGennie can continue sending. Reconnect it in Settings → Mailboxes, then resume.`;
  }
  await markMailboxError(s.workspaceId, s.mailboxId, err.message);
  return `${label} won't send from ${s.mailboxEmail}: ${err.message}. Fix it in Settings → Mailboxes, then resume.`;
}

/** Records the success everywhere in ONE transaction: message, send row, campaign counter, next step's timing, lead state. */
async function finalizeSent(s: SendContext, m: MessageRow, providerId: string | null, threadId: string | null, now: Date): Promise<void> {
  const at = now.toISOString();
  await sql.transaction([
    // Counted only when this call is the one that flips the send from pending — a replay of finalize never double-counts.
    sql`update campaigns set sent_count = sent_count + (select count(*)::int from campaign_sends where id = ${s.sendId} and status = 'pending')
        where id = ${s.campaignId} and workspace_id = ${s.workspaceId}`,
    sql`update messages set status = case when status = 'sending' then 'sent' else status end, provider_message_id = coalesce(provider_message_id, ${providerId || null}), provider_thread_id = coalesce(provider_thread_id, ${threadId}),
          sent_at = coalesce(sent_at, ${at}::timestamptz), attempts = attempts + case when status = 'sending' then 1 else 0 end, error = null, error_class = null, updated_at = now()
        where id = ${m.id} and workspace_id = ${s.workspaceId}`,
    sql`update campaign_sends set status = 'sent', sent_at = ${at}::timestamptz, subject = ${m.subject}, body = ${m.body}, provider_message_id = ${providerId || null}, error_message = null
        where id = ${s.sendId} and workspace_id = ${s.workspaceId} and status = 'pending'`,
    ...(s.campaignLeadId !== null
      ? [shiftNextStepStmt(s.workspaceId, s.campaignLeadId, now), markLeadSentStmt(s.workspaceId, s.campaignLeadId, s.sendId), settleCampaignStmt(s.workspaceId, s.campaignId)]
      : []),
  ]);
}

async function failMessage(s: SendContext, m: MessageRow, error: string, errorClass: string, now: Date): Promise<void> {
  await sql.transaction([
    sql`update messages set status = 'failed', error = ${error.slice(0, 1000)}, error_class = ${errorClass}, failed_at = ${now.toISOString()}::timestamptz, updated_at = now()
        where id = ${m.id} and workspace_id = ${s.workspaceId} and status in ('sending', 'failed')`,
    sql`update campaign_sends set status = 'failed', error_message = ${error.slice(0, 1000)} where id = ${s.sendId} and workspace_id = ${s.workspaceId} and status = 'pending'`,
  ]);
  if (s.campaignLeadId !== null) await stopLead(s.workspaceId, s.campaignLeadId, s.campaignId, error.slice(0, 200), "failed");
}

// ---- suppression --------------------------------------------------------------------------------------------------

/** Why this recipient must not be emailed right now (or null). Re-checked before EVERY email, not just at enrollment. */
async function suppressionReason(s: SendContext): Promise<string | null> {
  if (!s.leadEmail) return "Lead has no email address";
  if (s.leadEmailStatus === "invalid") return "Email address is invalid";
  if (await isOnDoNotContact(s.workspaceId, s.leadEmail)) return "Recipient is on the Do Not Contact list";
  // Another campaign's recent email — but never this campaign's own earlier steps.
  if ((await getLeadsInCooldown(s.workspaceId, [s.leadId], undefined, { excludeCampaignId: s.campaignId })).has(s.leadId)) {
    return "Recipient was contacted by another campaign within the cooldown window";
  }
  return null;
}

async function stopSend(s: SendContext, reason: string): Promise<HandlerOutcome> {
  await sql`update campaign_sends set status = 'blocked', error_message = ${reason} where id = ${s.sendId} and workspace_id = ${s.workspaceId} and status = 'pending'`;
  if (s.campaignLeadId !== null) await stopLead(s.workspaceId, s.campaignLeadId, s.campaignId, reason);
  return done({ blocked: reason });
}
