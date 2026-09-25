import type { Tone } from "@/components/ui/Badge";
import type { CampaignStatus } from "@/lib/actions/campaigns";

/** Presentation metadata for each campaign status (badge tone, label, live pulse). */
export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone; pulse?: boolean }> = {
  running: { label: "Running", tone: "emerald", pulse: true },
  paused: { label: "Paused", tone: "amber" },
  pending_approval: { label: "Pending approval", tone: "violet" },
  rejected: { label: "Rejected", tone: "rose" },
};

export const CAMPAIGN_STATUS_ORDER: CampaignStatus[] = ["running", "pending_approval", "paused", "rejected"];

/** "email" / "linkedin" / "linkedin_dm" → the distinct channel families a campaign uses. */
export function channelFamilies(channels: string[] | string | null | undefined): ("email" | "linkedin")[] {
  const list = Array.isArray(channels) ? channels : typeof channels === "string" ? channels.replace(/[{}]/g, "").split(",") : [];
  const out = new Set<"email" | "linkedin">();
  for (const c of list) {
    if (c.startsWith("email")) out.add("email");
    else if (c.startsWith("linkedin")) out.add("linkedin");
  }
  return Array.from(out);
}

/** Column template shared by the list header and every row (md and up). */
export const CAMPAIGN_ROW_GRID = "md:grid md:grid-cols-[minmax(0,1fr)_132px_64px_64px_96px_72px_236px] md:items-center md:gap-x-3";
