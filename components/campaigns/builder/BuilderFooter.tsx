import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { BUILDER_STEPS, type BuilderStepKey } from "./BuilderStepper";

export type BuilderNav = { step: BuilderStepKey; go: (k: BuilderStepKey) => void };

/** Sticky action bar at the bottom of each builder step: position + Back on the left, the step's action and Next on the right. */
export default function BuilderFooter({ nav, hint, children }: { nav: BuilderNav; hint?: ReactNode; children?: ReactNode }) {
  const i = BUILDER_STEPS.findIndex((s) => s.key === nav.step);
  const prev = BUILDER_STEPS[i - 1];
  const next = BUILDER_STEPS[i + 1];
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {prev && (
          <Button variant="secondary" onClick={() => nav.go(prev.key)}>
            <ArrowLeft className="h-4 w-4" weight="bold" /> Back
          </Button>
        )}
        <p className="hidden min-w-0 truncate text-xs text-neutral-500 sm:block">
          <span className="font-medium text-neutral-700">Step {i + 1} of {BUILDER_STEPS.length}</span> · {BUILDER_STEPS[i].label}
          {hint && <> · {hint}</>}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {children}
          {next && (
            <Button variant={children ? "secondary" : "primary"} onClick={() => nav.go(next.key)}>
              Next <ArrowRight className="h-4 w-4" weight="bold" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
