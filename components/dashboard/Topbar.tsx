"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, LogOut, ChevronDown } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export default function Topbar({
  user,
  onMenuClick,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    workspaceName?: string | null;
    role?: string | null;
  };
  onMenuClick: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initials =
    user.name
      ?.split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <header className="h-16 shrink-0 border-b border-white/10 bg-[#050505]/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6">
      <button
        onClick={onMenuClick}
        className="md:hidden text-neutral-400 hover:text-white"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <Link
        href="/dashboard/workspace"
        className="hidden md:flex items-center gap-2 text-sm text-neutral-500 hover:text-white transition-colors"
      >
        {user.workspaceName ?? user.company ?? "LeadGennie"}
        {user.role && (
          <span className="text-[11px] text-neutral-400 border border-white/10 rounded-full px-2 py-0.5">
            {ROLE_LABEL[user.role] ?? user.role}
          </span>
        )}
      </Link>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-xs font-semibold text-white">
            {initials}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm text-white leading-tight">{user.name}</p>
            <p className="text-xs text-neutral-500 leading-tight">{user.email}</p>
          </div>
          <ChevronDown className="w-4 h-4 text-neutral-500 hidden sm:block" />
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 rounded-lg border border-white/10 bg-[#0A0A0A] shadow-2xl z-20 overflow-hidden">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
