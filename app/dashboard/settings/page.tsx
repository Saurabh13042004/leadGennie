import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import SettingsFrame from "@/components/settings/SettingsFrame";
import { IconTile } from "@/components/settings/bits";
import { settingsNav } from "@/lib/settings-nav";

export const metadata = {
  title: "Settings | LeadGennie",
};

export default function SettingsPage() {
  return (
    <SettingsFrame title="Settings" description="Your workspace, sending setup and connected tools.">
      <div className="space-y-8">
        {settingsNav.map((group) => (
          <section key={group.label}>
            <h3 className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400">{group.label}</h3>
            <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
              {group.items.map(({ title, description, href, icon }) => (
                <li key={href}>
                  <Link href={href} className="group flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-neutral-50/80">
                    <IconTile icon={icon} className="group-hover:text-indigo-600" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-neutral-900">{title}</span>
                      <span className="block truncate text-xs text-neutral-500">{description}</span>
                    </span>
                    <CaretRight className="h-3.5 w-3.5 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" weight="bold" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SettingsFrame>
  );
}
