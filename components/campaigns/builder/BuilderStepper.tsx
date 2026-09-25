import { Check } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

export type BuilderStepKey = "basics" | "audience" | "sequence" | "personalization" | "preview" | "review";

export const BUILDER_STEPS: { key: BuilderStepKey; label: string; description: string }[] = [
  { key: "basics", label: "Basics", description: "Sender, limits, window" },
  { key: "audience", label: "Audience", description: "Who, and who's excluded" },
  { key: "sequence", label: "Sequence", description: "The emails and timing" },
  { key: "personalization", label: "Personalization", description: "Per-lead emails" },
  { key: "preview", label: "Preview", description: "Exactly what they get" },
  { key: "review", label: "Review", description: "Submit for approval" },
];

/**
 * Builder progress rail (same look as the campaign wizard's): vertical on large screens, a compact strip below.
 * Unlike the wizard every step is clickable — nothing is lost by jumping around — and a red dot marks steps with blockers.
 */
export default function BuilderStepper({ current, blocked, onSelect }: { current: BuilderStepKey; blocked: Set<string>; onSelect: (k: BuilderStepKey) => void }) {
  const currentIdx = BUILDER_STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 overflow-x-auto lg:flex-col lg:items-stretch lg:gap-0 lg:overflow-visible">
      {BUILDER_STEPS.map((s, i) => {
        const isActive = i === currentIdx;
        const hasBlocker = blocked.has(s.key);
        const isDone = !isActive && !hasBlocker && s.key !== "preview" && s.key !== "review";
        const isLast = i === BUILDER_STEPS.length - 1;
        return (
          <li key={s.key} className={cn("relative lg:pb-5", isLast && "lg:pb-0")}>
            {!isLast && <span aria-hidden className="absolute bottom-0 left-3 top-7 hidden w-px bg-neutral-200 lg:block" />}
            <button type="button" onClick={() => onSelect(s.key)} aria-current={isActive ? "step" : undefined} className="group flex items-center gap-2.5 text-left lg:items-start">
              <span
                className={cn(
                  "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                  isActive ? "bg-neutral-900 text-white shadow-[0_0_0_4px_rgba(23,23,23,0.08)]" : isDone ? "bg-indigo-600 text-white" : "bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200 group-hover:ring-neutral-300",
                )}
              >
                {isDone ? <Check className="h-3 w-3" weight="bold" /> : i + 1}
                {hasBlocker && !isActive && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" aria-label="needs attention" />}
              </span>
              <span className="min-w-0">
                <span className={cn("block whitespace-nowrap text-[13px] font-medium", isActive ? "text-neutral-900" : "text-neutral-600 group-hover:text-neutral-900")}>{s.label}</span>
                <span className="hidden text-xs text-neutral-400 lg:block">{s.description}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
