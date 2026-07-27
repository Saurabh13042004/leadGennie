"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function DashboardShell({
  user,
  children,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    company?: string | null;
    workspaceName?: string | null;
    role?: string | null;
  };
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen w-full flex bg-background text-foreground overflow-hidden">
      <div className="hidden md:block w-64 shrink-0">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72">
            <div className="relative h-full">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 text-neutral-400 hover:text-white z-10"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Topbar user={user} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-grid-minor">{children}</main>
      </div>
    </div>
  );
}
