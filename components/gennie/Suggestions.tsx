"use client";

import { Crosshair, ListNumbers, MagnifyingGlass, Sparkle } from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";

/** Icon by what the prompt asks for — decoration only; the prompt text is what gets planned. */
function iconFor(s: string): { icon: NavIcon; cls: string } {
  const t = s.toLowerCase();
  if (t.startsWith("research")) return { icon: MagnifyingGlass, cls: "bg-sky-50 text-sky-600" };
  if (t.includes("contact first")) return { icon: Crosshair, cls: "bg-rose-50 text-rose-500" };
  if (t.includes("top") || t.includes("rank")) return { icon: ListNumbers, cls: "bg-amber-50 text-amber-600" };
  return { icon: Sparkle, cls: "bg-violet-50 text-violet-600" };
}

/** Starter prompts from the workspace's real state. Picking one fills the composer — it doesn't run anything. */
export default function Suggestions({ suggestions, disabled, onPick }: { suggestions: string[]; disabled?: boolean; onPick: (s: string) => void }) {
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-2">
      {suggestions.map((s) => {
        const { icon: Icon, cls } = iconFor(s);
        return (
          <button
            key={s}
            type="button"
            disabled={disabled}
            onClick={() => onPick(s)}
            className="group inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-200/80 bg-white py-1.5 pl-1.5 pr-3.5 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-[0_2px_8px_-2px_rgba(0,0,0,0.08)] disabled:pointer-events-none disabled:opacity-50"
          >
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`}>
              <Icon className="h-3.5 w-3.5" weight="duotone" />
            </span>
            <span className="truncate text-[13px] text-neutral-700 group-hover:text-neutral-900">{s}</span>
          </button>
        );
      })}
    </div>
  );
}
