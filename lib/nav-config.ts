import type { ComponentType } from "react";
import { SHOW_LEGACY_MODULES } from "@/lib/feature-flags";
import {
  Sparkle,
  SquaresFour,
  UsersThree,
  Megaphone,
  Tray,
  ChartLineUp,
  GearSix,
  Sun,
  Buildings,
  Handshake,
  CheckSquare,
  FlowArrow,
  Broadcast,
  CalendarBlank,
  ArrowsClockwise,
  Database,
  Bell,
  WebhooksLogo,
  Lifebuoy,
  ChartBar,
} from "@phosphor-icons/react/ssr";

export type NavIcon = ComponentType<{ className?: string; weight?: "duotone" | "fill" | "regular" | "bold" }>;

export type NavItem = {
  title: string;
  href: string;
  description: string;
  icon: NavIcon;
  /** Extra path prefixes that should highlight this item (e.g. sub-pages). */
  matchPrefixes?: string[];
  /** Rendered with the AI treatment at the top of the sidebar. */
  featured?: boolean;
  /** Pinned to the bottom of the sidebar instead of the main list. */
  placement?: "bottom";
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** Ask Gennie plus the six V1 destinations. Everything else lives under Settings or the legacy flag. */
export const primaryNav: NavItem[] = [
  { title: "Ask Gennie", href: "/dashboard/gennie", description: "Plan and run work over your leads", icon: Sparkle, featured: true },
  { title: "Command Center", href: "/dashboard", description: "Your outbound at a glance", icon: SquaresFour },
  {
    title: "Leads",
    href: "/dashboard/leads",
    description: "Leads, audiences and inbound",
    icon: UsersThree,
    matchPrefixes: ["/dashboard/lead-lists"],
  },
  { title: "Campaigns", href: "/dashboard/campaigns", description: "Sequences and sending", icon: Megaphone },
  { title: "Inbox", href: "/dashboard/inbox", description: "Replies and conversations", icon: Tray },
  { title: "Analytics", href: "/dashboard/analytics", description: "Outbound performance", icon: ChartLineUp },
  {
    title: "Settings",
    href: "/dashboard/settings",
    description: "Workspace, email and integrations",
    icon: GearSix,
    placement: "bottom",
    matchPrefixes: [
      "/dashboard/workspace",
      "/dashboard/deliverability",
      "/dashboard/domains",
      "/dashboard/do-not-contact",
      "/dashboard/ai-prompts",
      "/dashboard/integrations",
      "/dashboard/api-credentials",
      "/dashboard/activities",
    ],
  },
];

/** Non-V1 modules — only shown when NEXT_PUBLIC_SHOW_LEGACY_MODULES=true. */
export const legacyNav: NavItem[] = [
  { title: "Today's Brief", href: "/dashboard/brief", description: "Meetings, tasks, and signals", icon: Sun },
  { title: "Accounts", href: "/dashboard/accounts", description: "View accounts", icon: Buildings },
  { title: "Deals", href: "/dashboard/deals", description: "View deals", icon: Handshake },
  { title: "Tasks", href: "/dashboard/tasks", description: "CRM tasks & follow-ups", icon: CheckSquare },
  { title: "Agentic Flows", href: "/dashboard/agentic-flows", description: "Build & deploy workflows", icon: FlowArrow },
  { title: "Signals", href: "/dashboard/signals", description: "Monitor buying signals", icon: Broadcast },
  { title: "Meetings", href: "/dashboard/meetings", description: "Upcoming and past meetings", icon: CalendarBlank },
  { title: "CRM Sync", href: "/dashboard/crm-sync", description: "Sync with CRM systems", icon: ArrowsClockwise },
  { title: "Knowledge Sources", href: "/dashboard/knowledge", description: "Manage data sources", icon: Database },
  { title: "Notifications", href: "/dashboard/notifications", description: "Notification preferences", icon: Bell },
  { title: "Webhooks", href: "/dashboard/webhooks", description: "Manage webhook endpoints", icon: WebhooksLogo },
  { title: "Usage Report", href: "/dashboard/usage", description: "Activity charts & metrics", icon: ChartBar },
  { title: "Help & Support", href: "/dashboard/help", description: "Get assistance", icon: Lifebuoy },
];

export const navGroups: NavGroup[] = [
  { label: "", items: primaryNav },
  ...(SHOW_LEGACY_MODULES ? [{ label: "Legacy modules", items: legacyNav }] : []),
];

export const allNavItems: NavItem[] = [...primaryNav, ...legacyNav];

/** What the ⌘K menu can jump to: primary destinations, plus legacy ones only when they're switched on. */
export const searchableNavItems: NavItem[] = [...primaryNav, ...(SHOW_LEGACY_MODULES ? legacyNav : [])];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return [item.href, ...(item.matchPrefixes ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
