import type { ReactNode } from "react";
import { Info, Warning, WarningOctagon } from "@phosphor-icons/react/ssr";
import Badge from "@/components/ui/Badge";
import { Help, Label } from "@/components/ui/Field";
import Callout from "@/components/leads/intel/Callout";
import { CAMPAIGN_STATUS } from "@/components/campaigns/campaign-status";
import type { CampaignStatus } from "@/lib/domain/campaigns/types";

/** Small helpers shared by the campaign builder and campaign page — thin wrappers over the dashboard design system. */

/** Label + control + optional help line (the pattern every settings/builder form uses). */
export function Field({ label, htmlFor, hint, help, children }: { label: string; htmlFor?: string; hint?: ReactNode; help?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <Label htmlFor={htmlFor} hint={hint}>{label}</Label>
      {children}
      {help && <Help>{help}</Help>}
    </div>
  );
}

export function Notice({ tone, title, children }: { tone: "info" | "warn" | "error"; title?: ReactNode; children?: ReactNode }) {
  const icon = tone === "error" ? WarningOctagon : tone === "warn" ? Warning : Info;
  return <Callout tone={tone} icon={icon} title={title} role={tone === "error" ? "alert" : undefined}>{children}</Callout>;
}

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = CAMPAIGN_STATUS[status] ?? CAMPAIGN_STATUS.draft;
  return <Badge tone={m.tone} dot pulse={m.pulse}>{m.label}</Badge>;
}

export function formatWhen(iso: string | null, empty = "—"): string {
  if (!iso) return empty;
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** A server-action envelope, for components that call actions directly. */
export type Envelope<T> = { ok: true; data: T } | { ok: false; error: { message: string } };

/** Inline save result next to a footer button. */
export function SaveMessage({ message }: { message: { ok: boolean; text: string } | null }) {
  if (!message) return null;
  return <span role="status" className={message.ok ? "text-xs text-emerald-700" : "text-xs text-rose-600"}>{message.text}</span>;
}
