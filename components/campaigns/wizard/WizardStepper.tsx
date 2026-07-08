import { CircleCheckBig } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Audience", "Sequence", "Personalization", "Review"];

export default function WizardStepper({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-8">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm",
                isActive
                  ? "border-blue-500/40 bg-blue-500/10 text-white"
                  : isDone
                    ? "border-white/10 bg-white/5 text-neutral-300"
                    : "border-white/10 text-neutral-600"
              )}
            >
              {isDone ? (
                <CircleCheckBig className="w-4 h-4 text-green-400" />
              ) : (
                <span
                  className={cn(
                    "w-4 h-4 rounded-full text-[10px] flex items-center justify-center",
                    isActive ? "bg-blue-400 text-black" : "bg-white/10 text-neutral-500"
                  )}
                >
                  {stepNum}
                </span>
              )}
              {label}
            </div>
            {stepNum < STEPS.length && <div className="w-4 h-px bg-white/10" />}
          </div>
        );
      })}
    </div>
  );
}
