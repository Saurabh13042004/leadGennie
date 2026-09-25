"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { CaretUpDown, GearSix, SignOut, UsersThree } from "@phosphor-icons/react/ssr";
import Avatar from "@/components/ui/Avatar";
import { cn } from "@/lib/utils";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
  company?: string | null;
  workspaceName?: string | null;
  role?: string | null;
};

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member", viewer: "Viewer" };

function Popover({ open, onClose, className, children }: { open: boolean; onClose: () => void; className?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className={cn("absolute z-50 w-56 overflow-hidden rounded-xl bg-white p-1 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] ring-1 ring-neutral-200", className)}>{children}</div>
    </>
  );
}

function MenuItem({ href, icon: Icon, children, onClick }: { href?: string; icon: typeof GearSix; children: ReactNode; onClick?: () => void }) {
  const cls = "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900";
  const inner = (
    <>
      <Icon className="h-4 w-4 text-neutral-400" weight="duotone" />
      {children}
    </>
  );
  return href ? (
    <Link href={href} className={cls} onClick={onClick}>
      {inner}
    </Link>
  ) : (
    <button type="button" className={cls} onClick={onClick}>
      {inner}
    </button>
  );
}

/** Workspace identity at the top of the sidebar. There's one workspace per account today, so no switcher list. */
export default function WorkspaceMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  const name = user.workspaceName ?? user.company ?? "LeadGennie";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/70"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-neutral-800 to-neutral-950 shadow-[0_1px_2px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.15)]">
          <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2C12 2 12.5 8.5 15.5 11.5C18.5 12.5 22 12 22 12C22 12 18.5 12.5 15.5 15.5C12.5 18.5 12 22 12 22C12 22 11.5 18.5 8.5 15.5C5.5 12.5 2 12 2 12C2 12 5.5 12.5 8.5 11.5C11.5 8.5 12 2 12 2Z" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-neutral-900">{name}</span>
          {user.role && <span className="block text-[11px] text-neutral-400">{ROLE_LABEL[user.role] ?? user.role}</span>}
        </span>
        <CaretUpDown className="h-3.5 w-3.5 text-neutral-400" weight="bold" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="left-0 top-full mt-1">
        <MenuItem href="/dashboard/workspace" icon={UsersThree} onClick={() => setOpen(false)}>
          Workspace &amp; team
        </MenuItem>
        <MenuItem href="/dashboard/settings" icon={GearSix} onClick={() => setOpen(false)}>
          Settings
        </MenuItem>
      </Popover>
    </div>
  );
}

export function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative border-t border-neutral-200/70 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-white/70"
      >
        <Avatar name={user.name} size="md" className="h-7 w-7" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-neutral-900">{user.name ?? "Account"}</span>
          <span className="block truncate text-[11px] text-neutral-400">{user.email}</span>
        </span>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="bottom-full left-0 mb-1">
        <MenuItem icon={SignOut} onClick={() => signOut({ callbackUrl: "/login" })}>
          Sign out
        </MenuItem>
      </Popover>
    </div>
  );
}
