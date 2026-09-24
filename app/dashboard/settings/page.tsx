import Link from "next/link";
import { Settings, UsersRound, Mail, Ban, MessageSquare, Plug, KeyRound, Activity, Target } from "lucide-react";

export const metadata = {
  title: "Settings | LeadGennie",
};

const SECTIONS = [
  { title: "Positioning & ICP", description: "What you sell and who you sell to", href: "/dashboard/settings/positioning", icon: Target },
  { title: "Workspace & team", description: "Members, roles and invitations", href: "/dashboard/workspace", icon: UsersRound },
  { title: "Mailboxes & domains", description: "Sending domains, mailboxes and daily limits", href: "/dashboard/deliverability", icon: Mail },
  { title: "Do Not Contact", description: "Suppression list and opt-outs", href: "/dashboard/do-not-contact", icon: Ban },
  { title: "AI prompts", description: "Versioned prompts used to write messages", href: "/dashboard/ai-prompts", icon: MessageSquare },
  { title: "Integrations", description: "Connect HubSpot and other tools", href: "/dashboard/integrations", icon: Plug },
  { title: "API credentials", description: "Workspace token for the Chrome extension", href: "/dashboard/api-credentials", icon: KeyRound },
  { title: "Activity log", description: "Who did what, and when", href: "/dashboard/activities", icon: Activity },
];

export default function SettingsPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-start gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <Settings className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-neutral-500">Workspace, email, and integrations.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SECTIONS.map(({ title, description, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#0A0A0A] p-4 hover:bg-white/5 transition-colors"
          >
            <Icon className="w-5 h-5 text-neutral-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-white">{title}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
