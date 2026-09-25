"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavTab = { label: string; href: string; count?: number; exact?: boolean };

/** Underline tabs for sibling routes. Active = exact match, or prefix match unless `exact`. */
export default function NavTabs({ tabs, className }: { tabs: NavTab[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav className={cn("-mb-px flex gap-5 overflow-x-auto", className)}>
      {tabs.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-[13px] font-medium transition-colors",
              active ? "border-neutral-900 text-neutral-900" : "border-transparent text-neutral-500 hover:text-neutral-800",
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("rounded px-1 text-[10px] tabular-nums", active ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-500")}>
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Pill segmented control for in-page views (state lives in the caller). */
export function Segmented<T extends string>({ options, value, onChange, className }: { options: readonly T[] | { value: T; label: string }[]; value: T; onChange: (v: T) => void; className?: string }) {
  const items = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className={cn("inline-flex rounded-lg bg-neutral-100 p-0.5 ring-1 ring-inset ring-neutral-200/60", className)}>
      {items.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-3 py-1 text-[13px] font-medium transition-all",
            value === o.value ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200/80" : "text-neutral-500 hover:text-neutral-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
