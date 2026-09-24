"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, navGroups } from "@/lib/nav-config";

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white border-r border-neutral-200">
      <Link href="/dashboard" className="flex items-center gap-2.5 px-5 h-16 border-b border-neutral-200 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-neutral-900">
          <svg className="h-4.5 w-4.5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
          </svg>
        </div>
        <span className="text-[15px] font-extrabold tracking-tight text-neutral-900">LeadGennie</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            {group.label && (
              <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = isNavItemActive(item, pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-indigo-600" : "text-neutral-400")} />
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
