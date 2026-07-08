"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navGroups } from "@/lib/nav-config";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-[#0A0A0A] border-r border-white/10">
      <div className="flex items-center gap-2 px-5 h-16 border-b border-white/10 shrink-0">
        <div className="w-7 h-7 bg-white flex items-center justify-center rounded-sm">
          <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
          </svg>
        </div>
        <span className="text-white font-bold text-lg tracking-tight">LeadGennie</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-blue-500/10 text-white"
                        : "text-neutral-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-blue-400" : "text-neutral-500")} />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
