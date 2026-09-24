import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Audience", description: "Pick who to reach" },
  { label: "Sequence", description: "Write the touchpoints" },
  { label: "Review", description: "Confirm & submit" },
];

export default function WizardStepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center mb-8">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <li key={s.label} className={cn("flex items-center", stepNum < STEPS.length && "flex-1")}>
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 transition-colors",
                  isActive
                    ? "bg-indigo-600 text-white"
                    : isDone
                      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                      : "border border-neutral-200 bg-white text-neutral-400"
                )}
              >
                {isDone ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <div className="hidden sm:block">
                <p
                  className={cn(
                    "text-sm font-semibold",
                    isActive ? "text-neutral-900" : isDone ? "text-neutral-700" : "text-neutral-400"
                  )}
                >
                  {s.label}
                </p>
                <p className="text-xs text-neutral-400">{s.description}</p>
              </div>
            </div>
            {stepNum < STEPS.length && (
              <div className={cn("flex-1 h-px mx-3", isDone ? "bg-emerald-200" : "bg-neutral-200")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
