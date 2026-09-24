"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "All leads", href: "/dashboard/leads" },
  { label: "Audiences", href: "/dashboard/lead-lists" },
  { label: "Inbound", href: "/dashboard/leads/inbound" },
];

/** Leads is one destination with three views; this keeps them reachable now that the sidebar has one entry. */
export default function LeadsSubNav() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 mb-6 border-b border-white/10">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "px-3 py-2 text-sm -mb-px border-b-2 transition-colors",
              active ? "border-blue-400 text-white" : "border-transparent text-neutral-500 hover:text-white"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
