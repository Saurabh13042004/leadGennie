"use client";

import { useState } from "react";
import { List, X } from "@phosphor-icons/react/ssr";
import Sidebar from "./Sidebar";
import CommandMenu from "./CommandMenu";
import type { ShellUser } from "./SidebarMenus";

export default function DashboardShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f4f4f3] text-[13px] text-neutral-900 antialiased">
      <aside className="hidden w-[244px] shrink-0 md:block">
        <Sidebar user={user} onSearch={() => setSearchOpen(true)} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-neutral-900/30 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 bg-[#f4f4f3] shadow-2xl">
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 text-neutral-400 hover:text-neutral-900" aria-label="Close menu">
              <X className="h-5 w-5" weight="bold" />
            </button>
            <Sidebar user={user} onNavigate={() => setMobileOpen(false)} onSearch={() => { setMobileOpen(false); setSearchOpen(true); }} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 md:hidden">
          <button onClick={() => setMobileOpen(true)} className="text-neutral-500 hover:text-neutral-900" aria-label="Open menu">
            <List className="h-5 w-5" weight="bold" />
          </button>
          <span className="text-sm font-semibold tracking-tight">LeadGennie</span>
        </div>
        <main className="relative min-h-0 flex-1 overflow-y-auto bg-white md:rounded-xl md:shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.05)]">
          {children}
        </main>
      </div>

      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
