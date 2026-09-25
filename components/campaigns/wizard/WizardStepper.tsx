import { Check } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Audience", description: "Pick who to reach" },
  { label: "Sequence", description: "Write the touchpoints" },
  { label: "Review", description: "Confirm & submit" },
];

export const WIZARD_STEP_COUNT = STEPS.length;
export const wizardStepLabel = (step: number) => STEPS[step - 1]?.label ?? "";

/** Builder progress: a vertical rail on large screens, a compact horizontal strip below that. */
export default function WizardStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 lg:flex-col lg:items-stretch lg:gap-0">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        const isLast = stepNum === STEPS.length;
        return (
          <li key={s.label} className={cn("relative flex items-center gap-2.5 lg:items-start lg:pb-6", !isLast && "flex-1 lg:flex-none", isLast && "lg:pb-0")}>
            {!isLast && (
              <span
                aria-hidden
                className={cn("absolute bottom-0 left-3 top-7 hidden w-px lg:block", isDone ? "bg-indigo-200" : "bg-neutral-200")}
              />
            )}
            <span
              className={cn(
                "relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums transition-colors",
                isActive
                  ? "bg-neutral-900 text-white shadow-[0_0_0_4px_rgba(23,23,23,0.08)]"
                  : isDone
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200",
              )}
              aria-current={isActive ? "step" : undefined}
            >
              {isDone ? <Check className="h-3 w-3" weight="bold" /> : stepNum}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[13px] font-medium", isActive ? "text-neutral-900" : isDone ? "text-neutral-700" : "text-neutral-400")}>
                {s.label}
              </span>
              <span className="hidden text-xs text-neutral-400 lg:block">{s.description}</span>
            </span>
            {!isLast && <span aria-hidden className={cn("h-px flex-1 lg:hidden", isDone ? "bg-indigo-200" : "bg-neutral-200")} />}
          </li>
        );
      })}
    </ol>
  );
}
