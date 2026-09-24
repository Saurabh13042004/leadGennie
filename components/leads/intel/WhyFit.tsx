import { Check, CircleHelp, Minus, X } from "lucide-react";
import type { CriterionView } from "@/lib/intelligence/read-model";

const ICON = {
  met: { Icon: Check, cls: "text-green-400", label: "Matches" },
  partial: { Icon: Minus, cls: "text-yellow-300", label: "Partly matches" },
  not_met: { Icon: X, cls: "text-red-400", label: "Does not match" },
  unknown: { Icon: CircleHelp, cls: "text-neutral-500", label: "Unknown" },
} as const;

/** "Why this lead?" — templated by the engine from the score breakdown, so it can't disagree with the number. */
export default function WhyFit({ items }: { items: CriterionView[] }) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <h2 className="text-sm font-semibold text-white">Why this lead?</h2>
      <ul className="mt-3 space-y-2.5">
        {items.map((w) => {
          const { Icon, cls, label } = ICON[w.status];
          return (
            <li key={w.criterion} className="flex items-start gap-2.5 text-sm">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cls}`} aria-label={label} />
              <span className="text-neutral-200">
                {w.text}
                {w.evidenceIds.length > 0 && (
                  <a href={`#evidence-${w.evidenceIds[0]}`} className="ml-1.5 text-xs text-blue-400 hover:underline">source</a>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
