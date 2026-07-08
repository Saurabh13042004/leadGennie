import type { LucideIcon } from "lucide-react";
import {
  Gauge,
  Sun,
  Users,
  List,
  Building2,
  Handshake,
  CheckSquare,
  Workflow,
  MessageSquare,
  Megaphone,
  Radio,
  Mail,
  Inbox,
  Calendar,
  Plug,
  RefreshCw,
  Database,
  Bell,
  Ban,
  Activity,
  KeyRound,
  Webhook,
  LifeBuoy,
  BarChart3,
} from "lucide-react";

export type NavItem = {
  title: string;
  href: string;
  description: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        description: "Juntrax Solutions Sales Agent",
        icon: Gauge,
      },
      {
        title: "Today's Brief",
        href: "/dashboard/brief",
        description: "Meetings, tasks, and signals",
        icon: Sun,
      },
    ],
  },
  {
    label: "CRM Core",
    items: [
      { title: "All Leads", href: "/dashboard/leads", description: "Manage your leads", icon: Users },
      { title: "Lead Lists", href: "/dashboard/lead-lists", description: "Organize lead groups", icon: List },
      { title: "Accounts", href: "/dashboard/accounts", description: "View accounts", icon: Building2 },
      { title: "Deals", href: "/dashboard/deals", description: "View deals", icon: Handshake },
      { title: "Tasks", href: "/dashboard/tasks", description: "CRM tasks & follow-ups", icon: CheckSquare },
    ],
  },
  {
    label: "Automations & Messaging",
    items: [
      { title: "Agentic Flows", href: "/dashboard/agentic-flows", description: "Build & deploy autonomous agents", icon: Workflow },
      { title: "AI Message Prompts", href: "/dashboard/ai-prompts", description: "Train and tune autonomous agents", icon: MessageSquare },
      { title: "Launch Campaigns", href: "/dashboard/campaigns", description: "Setup customer engagement agents", icon: Megaphone },
    ],
  },
  {
    label: "Signal Monitoring",
    items: [
      { title: "Signal Monitoring", href: "/dashboard/signals", description: "Monitor buying signals", icon: Radio },
    ],
  },
  {
    label: "Email Deliverability",
    items: [
      { title: "Email Deliverability", href: "/dashboard/deliverability", description: "Mailboxes, domains & warmup", icon: Mail },
    ],
  },
  {
    label: "Meeting Intelligence",
    items: [
      { title: "Unified Inbox", href: "/dashboard/inbox", description: "Aggregated email conversations", icon: Inbox },
      { title: "Meetings", href: "/dashboard/meetings", description: "Upcoming and past meetings", icon: Calendar },
    ],
  },
  {
    label: "Connections & Data",
    items: [
      { title: "Integrations", href: "/dashboard/integrations", description: "Connect your tools", icon: Plug },
      { title: "CRM Sync", href: "/dashboard/crm-sync", description: "Sync with CRM systems", icon: RefreshCw },
      { title: "Knowledge Sources", href: "/dashboard/knowledge", description: "Manage data sources", icon: Database },
    ],
  },
  {
    label: "Control & Administration",
    items: [
      { title: "Notifications", href: "/dashboard/notifications", description: "Notification preferences", icon: Bell },
      { title: "Do Not Contact", href: "/dashboard/do-not-contact", description: "Exclusion list", icon: Ban },
      { title: "Activities", href: "/dashboard/activities", description: "View activities", icon: Activity },
      { title: "API Credentials", href: "/dashboard/api-credentials", description: "Secure API access", icon: KeyRound },
      { title: "Webhooks", href: "/dashboard/webhooks", description: "Manage webhook endpoints", icon: Webhook },
      { title: "Help & Support", href: "/dashboard/help", description: "Get assistance", icon: LifeBuoy },
      { title: "Usage Report", href: "/dashboard/usage", description: "Activity charts & metrics", icon: BarChart3 },
    ],
  },
];

export const allNavItems: NavItem[] = navGroups.flatMap((g) => g.items);
