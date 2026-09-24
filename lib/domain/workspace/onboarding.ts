import { isIcpDefined, parseStoredIcp } from "./icp";

/**
 * The onboarding checklist. Steps are DERIVED from real workspace state each
 * time it is computed — nothing is stored as "done", so progress can never be
 * faked or drift from reality. The only persisted bit is whether the user
 * dismissed the card.
 */

export type OnboardingFacts = {
  positioning: string | null;
  icp: unknown;
  hasActiveMailbox: boolean;
  hasLeads: boolean;
  dismissedAt: string | null;
};

export type ChecklistStep = {
  id: "positioning" | "icp" | "email" | "leads";
  title: string;
  description: string;
  href: string;
  done: boolean;
};

export type Checklist = {
  steps: ChecklistStep[];
  completed: number;
  total: number;
  allDone: boolean;
  dismissed: boolean;
  /** Whether the dashboard should show the card at all. */
  visible: boolean;
};

export function buildChecklist(f: OnboardingFacts): Checklist {
  const steps: ChecklistStep[] = [
    {
      id: "positioning",
      title: "Describe what you sell",
      description: "One or two sentences on your product and who it helps — every message is written from this.",
      href: "/dashboard/settings/positioning",
      done: !!f.positioning?.trim(),
    },
    {
      id: "icp",
      title: "Define your ICP",
      description: "Industries, company size, regions and target titles you want to reach.",
      href: "/dashboard/settings/positioning#icp",
      done: isIcpDefined(parseStoredIcp(f.icp)),
    },
    {
      id: "email",
      title: "Connect email",
      description: "Verify a sending domain and activate a mailbox.",
      href: "/dashboard/deliverability",
      done: f.hasActiveMailbox,
    },
    {
      id: "leads",
      title: "Import leads",
      description: "Upload a CSV or add your first lead.",
      href: "/dashboard/leads",
      done: f.hasLeads,
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const allDone = completed === steps.length;
  const dismissed = f.dismissedAt !== null;
  return { steps, completed, total: steps.length, allDone, dismissed, visible: !allDone && !dismissed };
}
