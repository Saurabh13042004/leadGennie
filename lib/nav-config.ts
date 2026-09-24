import type { LucideIcon } from "lucide-react";
import { SHOW_LEGACY_MODULES } from "@/lib/feature-flags";
import {
  Gauge,
  Sun,
  Users,
  Building2,
  Handshake,
  CheckSquare,
  Workflow,
  Megaphone,
  Radio,
  Inbox,
  Calendar,
  RefreshCw,
  Database,
  Bell,
  Webhook,
  LifeBuoy,
  BarChart3,
  Settings,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
  /** Extra path prefixes that should highlight this item (e.g. sub-pages). */
  matchPrefixes?: string[];
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** The six V1 destinations. Everything else lives under Settings or the legacy flag. */
export const primaryNav: NavItem[] = [
  { title: "Command Center", href: "/dashboard", description: "Your outbound at a glance", icon: Gauge },
  {
    title: "Leads",
    href: "/dashboard/leads",
    description: "Leads, audiences and inbound",
    icon: Users,
    matchPrefixes: ["/dashboard/lead-lists"],
  },
  { title: "Campaigns", href: "/dashboard/campaigns", description: "Sequences and sending", icon: Megaphone },
  { title: "Inbox", href: "/dashboard/inbox", description: "Replies and conversations", icon: Inbox },
  { title: "Analytics", href: "/dashboard/analytics", description: "Outbound performance", icon: BarChart3 },
  {
    title: "Settings",
    href: "/dashboard/settings",
    description: "Workspace, email and integrations",
    icon: Settings,
    matchPrefixes: [
      "/dashboard/workspace",
      "/dashboard/deliverability",
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
  { title: "Accounts", href: "/dashboard/accounts", description: "View accounts", icon: Building2 },
  { title: "Deals", href: "/dashboard/deals", description: "View deals", icon: Handshake },
  { title: "Tasks", href: "/dashboard/tasks", description: "CRM tasks & follow-ups", icon: CheckSquare },
  { title: "Agentic Flows", href: "/dashboard/agentic-flows", description: "Build & deploy workflows", icon: Workflow },
  { title: "Signals", href: "/dashboard/signals", description: "Monitor buying signals", icon: Radio },
  { title: "Meetings", href: "/dashboard/meetings", description: "Upcoming and past meetings", icon: Calendar },
  { title: "CRM Sync", href: "/dashboard/crm-sync", description: "Sync with CRM systems", icon: RefreshCw },
  { title: "Knowledge Sources", href: "/dashboard/knowledge", description: "Manage data sources", icon: Database },
  { title: "Notifications", href: "/dashboard/notifications", description: "Notification preferences", icon: Bell },
  { title: "Webhooks", href: "/dashboard/webhooks", description: "Manage webhook endpoints", icon: Webhook },
  { title: "Usage Report", href: "/dashboard/usage", description: "Activity charts & metrics", icon: BarChart3 },
  { title: "Help & Support", href: "/dashboard/help", description: "Get assistance", icon: LifeBuoy },
];

export const navGroups: NavGroup[] = [
  { label: "", items: primaryNav },
  ...(SHOW_LEGACY_MODULES ? [{ label: "Legacy modules", items: legacyNav }] : []),
];

export const allNavItems: NavItem[] = [...primaryNav, ...legacyNav];

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/dashboard") return pathname === "/dashboard";
  return [item.href, ...(item.matchPrefixes ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
