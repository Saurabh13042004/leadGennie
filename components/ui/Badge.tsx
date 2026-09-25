import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "indigo" | "emerald" | "amber" | "rose" | "sky" | "violet" | "orange";

export const TONE: Record<Tone, { badge: string; dot: string; soft: string; text: string }> = {
  neutral: { badge: "bg-neutral-100 text-neutral-600 ring-neutral-200/80", dot: "bg-neutral-400", soft: "bg-neutral-100", text: "text-neutral-600" },
  indigo: { badge: "bg-indigo-50 text-indigo-700 ring-indigo-200/70", dot: "bg-indigo-500", soft: "bg-indigo-50", text: "text-indigo-600" },
  emerald: { badge: "bg-emerald-50 text-emerald-700 ring-emerald-200/70", dot: "bg-emerald-500", soft: "bg-emerald-50", text: "text-emerald-600" },
  amber: { badge: "bg-amber-50 text-amber-700 ring-amber-200/70", dot: "bg-amber-500", soft: "bg-amber-50", text: "text-amber-600" },
  rose: { badge: "bg-rose-50 text-rose-700 ring-rose-200/70", dot: "bg-rose-500", soft: "bg-rose-50", text: "text-rose-600" },
  sky: { badge: "bg-sky-50 text-sky-700 ring-sky-200/70", dot: "bg-sky-500", soft: "bg-sky-50", text: "text-sky-600" },
  violet: { badge: "bg-violet-50 text-violet-700 ring-violet-200/70", dot: "bg-violet-500", soft: "bg-violet-50", text: "text-violet-600" },
  orange: { badge: "bg-orange-50 text-orange-700 ring-orange-200/70", dot: "bg-orange-500", soft: "bg-orange-50", text: "text-orange-600" },
};

/** Small status pill. `dot` adds a leading status dot (use for states; omit for plain labels). */
export default function Badge({ tone = "neutral", dot, pulse, className, children }: { tone?: Tone; dot?: boolean; pulse?: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-1.5 text-[11px] font-medium ring-1 ring-inset", TONE[tone].badge, className)}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", TONE[tone].dot)} />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />
        </span>
      )}
      {children}
    </span>
  );
}
