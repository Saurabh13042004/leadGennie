import "@/lib/email/resend-provider";
import { randomUUID } from "node:crypto";
import { createLogger } from "@/lib/log";
import { getMailProvider } from "@/lib/email/provider";
import type { EmailContent } from "@/lib/email/templates/layout";

const log = createLogger({ scope: "email.system" });

export type SystemMailResult = { sent: true; id: string } | { sent: false; reason: "not_configured" | "failed" };

/**
 * LeadGennie's own transactional mail (invites, welcome) — NOT campaign sending: no mailbox, no limits, no suppression
 * list, no compliance footer (these are messages the recipient's account actions cause). It goes through the same
 * `MailProvider` port, so tests use the fake and the real thing is Resend.
 *
 * It never throws: an invite or a sign-up must not fail because mail is down or unconfigured. The caller gets `sent: false`
 * and decides what to tell the user.
 */
export async function sendSystemEmail(msg: EmailContent & { to: string; kind: string }): Promise<SystemMailResult> {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  const provider = getMailProvider();
  if (!from || !provider.isConfigured()) {
    log.warn("system_mail.not_configured", { kind: msg.kind, has_from: Boolean(from) });
    return { sent: false, reason: "not_configured" };
  }
  try {
    const { id } = await provider.send({
      from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html,
      idempotencyKey: `system-${msg.kind}-${randomUUID()}`, tags: [{ name: "kind", value: msg.kind }],
    });
    return { sent: true, id };
  } catch (err) {
    log.error("system_mail.failed", { kind: msg.kind, err });
    return { sent: false, reason: "failed" };
  }
}
