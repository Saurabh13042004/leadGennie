import type { Tone } from "@/components/ui/Badge";
import type { MailboxProviderKey, MailboxStatus } from "@/lib/domain/mailboxes/types";

/** How each stored status reads to a user. `active` is "Connected" for accounts you sign into, "Active" for a Resend domain address. */
export function mailboxStatusMeta(status: MailboxStatus, provider: MailboxProviderKey): { tone: Tone; label: string } {
  switch (status) {
    case "active": return { tone: "emerald", label: provider === "resend" ? "Active" : "Connected" };
    case "pending_approval": return { tone: "indigo", label: "Pending approval" };
    case "paused": return { tone: "amber", label: "Paused" };
    case "reconnect_required": return { tone: "rose", label: "Reconnect required" };
    case "disconnected": return { tone: "neutral", label: "Disconnected" };
    case "error": return { tone: "rose", label: "Error" };
  }
}

/** The colour + letter mark for each provider (plain text, no third-party logos). */
export const PROVIDER_MARK: Record<MailboxProviderKey, { letter: string; cls: string }> = {
  gmail: { letter: "G", cls: "bg-white text-[#EA4335] ring-neutral-200" },
  microsoft: { letter: "M", cls: "bg-[#0078D4]/10 text-[#0078D4] ring-[#0078D4]/20" },
  resend: { letter: "R", cls: "bg-neutral-900 text-white ring-neutral-900" },
};
