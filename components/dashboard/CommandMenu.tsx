"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowElbowDownLeft, MagnifyingGlass } from "@phosphor-icons/react/ssr";
import { searchableNavItems } from "@/lib/nav-config";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/Field";

/** ⌘K / Ctrl+K palette that jumps between dashboard destinations. Owns the global shortcut. */
export default function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      } else if (e.key === "Escape" && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Mounted fresh on every open, so the query and selection always start clean.
  return open ? <Palette onClose={() => onOpenChange(false)} /> : null;
}

function Palette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return searchableNavItems;
    return searchableNavItems.filter((i) => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
  }, [query]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-neutral-900/20 px-4 pt-[14vh] backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="Search"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-12px_rgba(0,0,0,0.25)] ring-1 ring-neutral-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-neutral-100 px-4">
          <MagnifyingGlass className="h-4 w-4 text-neutral-400" weight="bold" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                go(results[active].href);
              }
            }}
            placeholder="Jump to…"
            className="h-12 flex-1 bg-transparent text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <Kbd>Esc</Kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-neutral-400">Go to</p>
          {results.length === 0 && <p className="px-2.5 py-6 text-center text-[13px] text-neutral-400">No matches for “{query}”</p>}
          {results.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item.href)}
                className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active && "bg-neutral-100")}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset",
                    item.featured ? "bg-gradient-to-br from-indigo-500 to-violet-500 text-white ring-transparent" : "bg-white text-neutral-600 ring-neutral-200",
                  )}
                >
                  <Icon className="h-4 w-4" weight={item.featured ? "fill" : "duotone"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-neutral-900">{item.title}</span>
                  <span className="block truncate text-xs text-neutral-500">{item.description}</span>
                </span>
                {i === active && <ArrowElbowDownLeft className="h-3.5 w-3.5 text-neutral-400" weight="bold" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
