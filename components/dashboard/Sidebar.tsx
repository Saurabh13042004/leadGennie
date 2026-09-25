"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { isNavItemActive, navGroups, type NavItem } from "@/lib/nav-config";
import { Kbd } from "@/components/ui/Field";
import WorkspaceMenu, { UserMenu, type ShellUser } from "./SidebarMenus";

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  if (item.featured) {
    return (
      <Link
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "group flex h-9 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-all",
          active
            ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/80"
            : "text-neutral-700 hover:bg-white/70",
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-[0_2px_6px_-1px_rgba(124,58,237,0.5)]">
          <Icon className="h-3.5 w-3.5" weight="fill" />
        </span>
        <span className="flex-1 truncate">{item.title}</span>
        <span className="rounded bg-gradient-to-r from-indigo-500/10 to-fuchsia-500/10 px-1.5 py-px text-[10px] font-semibold text-violet-600 ring-1 ring-inset ring-violet-500/15">AI</span>
      </Link>
    );
  }
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-lg px-2 text-[13px] font-medium transition-all",
        active
          ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ring-1 ring-neutral-200/80"
          : "text-neutral-600 hover:bg-white/70 hover:text-neutral-900",
      )}
    >
      <Icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-indigo-600" : "text-neutral-400")} weight={active ? "fill" : "duotone"} />
      <span className="truncate">{item.title}</span>
    </Link>
  );
}

export default function Sidebar({ user, onNavigate, onSearch }: { user: ShellUser; onNavigate?: () => void; onSearch: () => void }) {
  const pathname = usePathname();
  const main = navGroups.map((g) => ({ ...g, items: g.items.filter((i) => i.placement !== "bottom") }));
  const bottom = navGroups.flatMap((g) => g.items).filter((i) => i.placement === "bottom");

  return (
    <div className="flex h-full flex-col gap-3 px-2.5 py-3">
      <WorkspaceMenu user={user} />

      <button
        type="button"
        onClick={onSearch}
        className="flex h-8 items-center gap-2 rounded-lg bg-white/60 px-2 text-[13px] text-neutral-400 ring-1 ring-inset ring-neutral-200/80 transition-colors hover:bg-white hover:text-neutral-600"
      >
        <MagnifyingGlass className="h-4 w-4" weight="bold" />
        <span className="flex-1 text-left">Search</span>
        <Kbd>⌘K</Kbd>
      </button>

      <nav className="flex-1 space-y-5 overflow-y-auto">
        {main.map((group) => (
          <div key={group.label || "main"} className="space-y-0.5">
            {group.label && <p className="px-2 pb-1 text-[11px] font-medium text-neutral-400">{group.label}</p>}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="space-y-0.5">
        {bottom.map((item) => (
          <NavLink key={item.href} item={item} active={isNavItemActive(item, pathname)} onNavigate={onNavigate} />
        ))}
      </div>
      <UserMenu user={user} />
    </div>
  );
}
