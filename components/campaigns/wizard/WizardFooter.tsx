import type { ReactNode } from "react";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { WIZARD_STEP_COUNT, wizardStepLabel } from "./WizardStepper";

/** Sticky action bar pinned to the bottom of the builder: step position + Back on the left, primary action on the right. */
export default function WizardFooter({
  step,
  onBack,
  hint,
  children,
}: {
  step: number;
  onBack?: () => void;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="sticky bottom-0 z-10 mt-auto border-t border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur-md md:px-8">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" weight="bold" />
            Back
          </Button>
        )}
        <p className="hidden min-w-0 truncate text-xs text-neutral-500 sm:block">
          <span className="font-medium text-neutral-700">
            Step {step} of {WIZARD_STEP_COUNT}
          </span>{" "}
          · {wizardStepLabel(step)}
          {hint && <> · {hint}</>}
        </p>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
