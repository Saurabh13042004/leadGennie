"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { settingsNav } from "@/lib/settings-nav";

/** Left sub-nav shared by every settings page (vertical on desktop, horizontal scroller on mobile). */
export default function SettingsNav() {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <nav aria-label="Settings" className="flex gap-1 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
      {settingsNav.map((g) => (
        <div key={g.label} className="flex gap-1 md:flex-col md:gap-0.5">
          <p className="hidden px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-neutral-400 md:block">{g.label}</p>
          {g.items.map(({ href, title, icon: I }) => {
            const on = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-[13px] font-medium transition-colors",
                  on ? "bg-neutral-100 text-neutral-900" : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900",
                )}
              >
                <I className={cn("h-4 w-4", on ? "text-indigo-600" : "text-neutral-400")} weight={on ? "fill" : "duotone"} />
                {title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
