import { AppError } from "@/lib/api/errors";
import { logActivity } from "@/lib/activity";
import { decryptSecret } from "@/lib/crypto";
import { createLogger } from "@/lib/log";
import type { MailboxProvider, MailboxRef } from "@/lib/email/mailbox-provider";
import { MailProviderError, toProviderError } from "@/lib/email/provider";
import { clearMailboxError, markDisconnected } from "./lifecycle";
import { getOAuthClient } from "./oauth/registry";
import { OAuthError } from "./oauth/types";
import "./register";
import { resolveMailboxProvider } from "./registry";
import { loadSecrets, type MailboxSecrets } from "./repository";
import { isOAuthProvider, mailboxBlockedReason, PROVIDER_LABEL } from "./types";

const log = createLogger({ scope: "mailbox.service" });

/**
 * MailboxService: the one place that turns "this mailbox" into "something that can send" and owns the operations on a connected
 * mailbox. Campaign sends do NOT come through `sendTestEmail` — they run in the `campaign_send` job, which resolves its provider
 * through the same registry after its own gate (limits, suppression, at-most-once claim). Both paths end in `MailboxProvider.send`.
 */

export type ResolvedMailbox = { provider: MailboxProvider; ref: MailboxRef; mailbox: Pick<MailboxSecrets, "id" | "email" | "provider" | "status" | "ownerUserId"> };

/** The provider adapter for a mailbox in this workspace. Throws NOT_FOUND for another workspace's mailbox — same as if it didn't exist. */
export async function providerForMailbox(workspaceId: number, mailboxId: number): Promise<ResolvedMailbox> {
  const m = await loadSecrets(workspaceId, mailboxId);
  if (!m) throw new AppError("NOT_FOUND", "Mailbox not found.");
  const ref: MailboxRef = { workspaceId, mailboxId: m.id, email: m.email, displayName: m.displayName, scopes: m.scopes };
  return { provider: resolveMailboxProvider(m.provider, ref), ref, mailbox: { id: m.id, email: m.email, provider: m.provider, status: m.status, ownerUserId: m.ownerUserId } };
}

/** What a user should read when a provider call fails — never the provider's raw error, which can carry ids and internals. */
export function describeProviderFailure(err: MailProviderError, providerLabel: string): string {
  switch (err.cls) {
    case "auth": return `Your ${providerLabel} mailbox needs to be reconnected before LeadGennie can continue sending.`;
    case "domain": return `${providerLabel} won't send from this mailbox: ${err.message}`;
    case "rate_limited": return `${providerLabel} is asking us to slow down. Try again in a minute.`;
    case "quota": return `This mailbox has reached ${providerLabel}'s sending limit for now. Try again later.`;
    case "permanent": return `${providerLabel} rejected the message: ${err.message}`;
    case "unknown_outcome": return `${providerLabel} didn't confirm whether the message was sent. Check the mailbox's Sent folder before trying again.`;
    default: return `${providerLabel} couldn't be reached. Try again in a minute.`;
  }
}

/** Sends a short test message from the mailbox to the signed-in user's own address. Never to a lead. */
export async function sendTestEmail(actor: { workspaceId: number; userId: number; email: string }, mailboxId: number): Promise<{ to: string }> {
  const { provider, mailbox } = await providerForMailbox(actor.workspaceId, mailboxId);
  const label = PROVIDER_LABEL[mailbox.provider];
  // `error` is allowed: a passing test is how a mailbox recovers from it.
  const blocked = mailbox.status === "error" ? null : mailboxBlockedReason({ provider: mailbox.provider, status: mailbox.status, domainStatus: mailbox.provider === "resend" ? "verified" : null });
  if (blocked) throw new AppError("CONFLICT", `This mailbox can't send: ${blocked}`);
  if (!provider.isConfigured()) throw new AppError("NOT_CONFIGURED", `${label} sending isn't configured on this server.`);

  let sent;
  try {
    sent = await provider.send({
      from: mailbox.email, to: actor.email, subject: "LeadGennie test email",
      text: `This is a test from LeadGennie.\n\nIf you're reading this, ${mailbox.email} is connected and can send outreach for your workspace.`,
      idempotencyKey: `mailbox-test-${mailbox.id}-${crypto.randomUUID()}`,
    });
  } catch (e) {
    const err = toProviderError(e);
    log.warn("mailbox.test_failed", { workspace_id: actor.workspaceId, mailbox_id: mailbox.id, provider: mailbox.provider, cls: err.cls, code: err.code });
    throw new AppError(err.cls === "auth" || err.cls === "domain" ? "CONFLICT" : "PROVIDER_ERROR", describeProviderFailure(err, label));
  }
  await clearMailboxError(actor.workspaceId, mailbox.id);
  await logActivity({
    workspaceId: actor.workspaceId, actorUserId: actor.userId, type: "mailbox.test_sent", entityType: "mailbox", entityId: mailbox.id,
    summary: `Sent a test email from ${mailbox.email} to ${actor.email}`, metadata: { provider: mailbox.provider, providerMessageId: sent.id, providerThreadId: sent.threadId ?? null },
  });
  return { to: actor.email };
}

/**
 * Disconnect an OAuth mailbox: revoke at the provider where the provider supports it (Google), delete our copy of the credentials,
 * mark it disconnected and pause the campaigns that use it. Revocation is best-effort — if Google is unreachable the local cleanup
 * still happens, because a user who asked to disconnect must never be left with a live token we can't remove.
 */
export async function disconnectMailbox(actor: { workspaceId: number; userId: number }, mailboxId: number): Promise<{ email: string; campaignsPaused: number; revoked: boolean }> {
  const m = await loadSecrets(actor.workspaceId, mailboxId);
  if (!m) throw new AppError("NOT_FOUND", "Mailbox not found.");
  if (!isOAuthProvider(m.provider)) throw new AppError("CONFLICT", "This mailbox sends through a Resend domain — remove it instead.");

  let revoked = false;
  const oauth = getOAuthClient(m.provider);
  const token = m.refreshTokenEnc ?? m.accessTokenEnc;
  if (oauth.revoke && token) {
    try {
      await oauth.revoke(decryptSecret(token));
      revoked = true;
    } catch (e) {
      log.warn("mailbox.revoke_failed", { workspace_id: actor.workspaceId, mailbox_id: m.id, provider: m.provider, kind: e instanceof OAuthError ? e.kind : "unknown" });
    }
  }
  const done = await markDisconnected(actor.workspaceId, mailboxId, actor.userId);
  return { ...done, revoked };
}
