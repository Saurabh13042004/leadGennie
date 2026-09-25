import { ClockCounterClockwise, EnvelopeSimple, Key, Plugs, Prohibit, Robot, Target, UsersThree } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";

export type SettingsNavItem = { title: string; description: string; href: string; icon: NavIcon };
export type SettingsNavGroup = { label: string; items: SettingsNavItem[] };

/** Every settings destination, grouped. The settings sub-nav and the /dashboard/settings index both read this. */
export const settingsNav: SettingsNavGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Positioning & ICP", description: "What you sell and who you sell to", href: "/dashboard/settings/positioning", icon: Target },
      { title: "Members", description: "Members, roles and invitations", href: "/dashboard/workspace", icon: UsersThree },
      { title: "API credentials", description: "Workspace token for the Chrome extension", href: "/dashboard/api-credentials", icon: Key },
      { title: "Activity log", description: "Who did what, and when", href: "/dashboard/activities", icon: ClockCounterClockwise },
    ],
  },
  {
    label: "Outreach",
    items: [
      { title: "Mailboxes & domains", description: "Sending domains, mailboxes and daily limits", href: "/dashboard/deliverability", icon: EnvelopeSimple },
      { title: "Do Not Contact", description: "Suppression list and opt-outs", href: "/dashboard/do-not-contact", icon: Prohibit },
      { title: "AI prompts", description: "Versioned prompts used to write messages", href: "/dashboard/ai-prompts", icon: Robot },
      { title: "Integrations", description: "Connect HubSpot and other tools", href: "/dashboard/integrations", icon: Plugs },
    ],
  },
];
