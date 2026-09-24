import Link from "next/link";
import { Settings, UsersRound, Mail, Ban, MessageSquare, Plug, KeyRound, Activity, Target, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Settings | LeadGennie",
};

const SECTION_GROUPS: {
  label: string;
  items: { title: string; description: string; href: string; icon: typeof Settings }[];
}[] = [
  {
    label: "Workspace",
    items: [
      { title: "Positioning & ICP", description: "What you sell and who you sell to", href: "/dashboard/settings/positioning", icon: Target },
      { title: "Workspace & team", description: "Members, roles and invitations", href: "/dashboard/workspace", icon: UsersRound },
      { title: "API credentials", description: "Workspace token for the Chrome extension", href: "/dashboard/api-credentials", icon: KeyRound },
      { title: "Activity log", description: "Who did what, and when", href: "/dashboard/activities", icon: Activity },
    ],
  },
  {
    label: "Outreach & sending",
    items: [
      { title: "Mailboxes & domains", description: "Sending domains, mailboxes and daily limits", href: "/dashboard/deliverability", icon: Mail },
      { title: "Do Not Contact", description: "Suppression list and opt-outs", href: "/dashboard/do-not-contact", icon: Ban },
      { title: "AI prompts", description: "Versioned prompts used to write messages", href: "/dashboard/ai-prompts", icon: MessageSquare },
      { title: "Integrations", description: "Connect HubSpot and other tools", href: "/dashboard/integrations", icon: Plug },
    ],
  },
];

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Settings</h1>
          <p className="text-sm text-neutral-500">Workspace, email, and integrations.</p>
        </div>
      </div>

      <div className="space-y-8">
        {SECTION_GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{group.label}</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.items.map(({ title, description, href, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 hover:bg-neutral-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{title}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-300 shrink-0 mt-1 group-hover:text-neutral-400 transition-colors" />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
