import { firstNameOf } from "@/lib/domain/personalization/context";

/**
 * The one place that turns a template (or an approved draft) into what a recipient receives. The builder preview,
 * launch-time materialisation and the dispatcher all go through here, so "what you previewed" and "what was sent"
 * cannot drift apart.
 */

export const SUPPORTED_PLACEHOLDERS = ["first_name", "company"] as const;

export function appBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
}

export type RenderLead = { fullName: string; company: string | null };

/** Replaces the supported placeholders. Unknown ones are left in place so a lint can flag them (never silently blank). */
export function fillPlaceholders(text: string, lead: RenderLead): string {
  const first = firstNameOf(lead.fullName) ?? "there";
  return text.replace(/\{\{\s*(first_name|company)\s*\}\}/g, (_, key: string) => (key === "first_name" ? first : lead.company?.trim() || "your company"));
}

/** Placeholders in a template that we don't know how to fill. */
export function unknownPlaceholders(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)) {
    if (!(SUPPORTED_PLACEHOLDERS as readonly string[]).includes(m[1])) found.add(m[0]);
  }
  return [...found];
}

/** Follow-ups are threaded replies to the first email: same subject, "Re:" prefixed once. */
export function threadedSubject(firstSubject: string): string {
  const s = firstSubject.trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

/** Who is sending, for the compliance footer (CAN-SPAM/GDPR need a sender name and a postal address). */
export type SenderIdentity = { name: string | null; address: string | null };

export const hasSenderIdentity = (i: SenderIdentity | null | undefined) => !!(i?.name?.trim() && i?.address?.trim());

/** `\n\n---\n<name>\n<address>\nUnsubscribe: <url>` — identity lines appear only when configured. */
export function unsubscribeFooter(unsubscribeUrl: string, identity?: SenderIdentity | null): string {
  const lines = [identity?.name?.trim(), identity?.address?.trim()].filter((l): l is string => !!l);
  return `\n\n---\n${lines.length > 0 ? `${lines.join("\n")}\n` : ""}Unsubscribe: ${unsubscribeUrl}`;
}

export function withUnsubscribeFooter(body: string, unsubscribeUrl: string, identity?: SenderIdentity | null): string {
  return `${body}${unsubscribeFooter(unsubscribeUrl, identity)}`;
}

export type StepSource = { order: number; subject: string; body: string; mode: "template" | "personalized" };
export type ApprovedDraft = { id: number; subject: string; body: string } | null;

export type RenderedStep = {
  order: number;
  subject: string;
  /** Body WITHOUT the unsubscribe footer (the dispatcher appends it at send time; preview shows both). */
  body: string;
  source: "draft" | "template";
  draftId: number | null;
};

/**
 * Renders one step for one lead. A personalized step uses the lead's APPROVED draft; without one it falls back to
 * the template only when the caller says fallback is allowed — otherwise it returns null (a launch blocker).
 */
export function renderStep(
  step: StepSource,
  firstStep: StepSource,
  lead: RenderLead,
  draft: ApprovedDraft,
  opts: { allowTemplateFallback: boolean },
): RenderedStep | null {
  const useDraft = step.mode === "personalized" && draft !== null;
  if (step.mode === "personalized" && !draft && !opts.allowTemplateFallback) return null;

  const firstSubject = firstStep.mode === "personalized" && draft ? draft.subject : fillPlaceholders(firstStep.subject, lead);
  const subject = step.order === 1 ? firstSubject : threadedSubject(firstSubject);
  const body = useDraft ? draft.body : fillPlaceholders(step.body, lead);
  return { order: step.order, subject, body, source: useDraft ? "draft" : "template", draftId: useDraft ? draft.id : null };
}
