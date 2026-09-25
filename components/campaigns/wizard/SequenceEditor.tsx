"use client";

import { ArrowRight, Hourglass, Plus } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import StepBody from "./StepBody";
import WizardFooter from "./WizardFooter";
import SequenceStepCard from "./SequenceStepCard";
import type { CampaignDraft } from "./useCampaignDraft";

/** Vertical timeline of touchpoints: numbered nodes, "wait N days" connectors, an editor card per step. */
export default function SequenceEditor({ draft }: { draft: CampaignDraft }) {
  const { steps, aiLoadingIdx, addStep, removeStep, updateStep, writeStep, setStep, totalDays, multichannel } = draft;

  const days = steps.map((_, i) => steps.slice(0, i + 1).reduce((acc, x) => acc + x.waitDays, 0));

  return (
    <>
      <StepBody title="Write the sequence" description="Each step sends automatically after its wait period. AI drafts each message from your pitch — edit freely.">
        <ol className="relative">
          <span aria-hidden className="absolute bottom-4 left-4 top-4 w-px -translate-x-1/2 bg-neutral-200" />
          {steps.map((s, idx) => {
            return (
              <li key={idx} className="relative">
                {idx > 0 && (
                  <div className="flex items-center gap-3 py-3 sm:gap-4">
                    <span className="relative flex w-8 shrink-0 justify-center">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200">
                        <Hourglass className="h-3 w-3" weight="duotone" />
                      </span>
                    </span>
                    <label className="flex items-center gap-2 text-xs text-neutral-500">
                      Wait
                      <input
                        type="number"
                        min={0}
                        value={s.waitDays}
                        onChange={(e) => updateStep(idx, { waitDays: Number(e.target.value) })}
                        className={cn(inputClasses, "h-7 w-14 px-2 text-center text-xs tabular-nums")}
                      />
                      days, then
                    </label>
                  </div>
                )}
                <div className="flex gap-3 sm:gap-4">
                  <span className="relative flex w-8 shrink-0 justify-center pt-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold tabular-nums text-white shadow-[0_0_0_4px_#fff]">
                      {idx + 1}
                    </span>
                  </span>
                  <SequenceStepCard
                    step={s}
                    idx={idx}
                    day={days[idx]}
                    aiLoading={aiLoadingIdx.has(idx)}
                    canRemove={steps.length > 1}
                    multichannel={multichannel}
                    onChange={(patch) => updateStep(idx, patch)}
                    onWrite={() => writeStep(idx, s.channel)}
                    onRemove={() => removeStep(idx)}
                  />
                </div>
              </li>
            );
          })}
          <li className="relative flex items-center gap-3 pt-5 sm:gap-4">
            <span className="relative flex w-8 shrink-0 justify-center">
              <button
                type="button"
                onClick={addStep}
                aria-label="Add step"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-neutral-300 bg-white text-neutral-500 transition-colors hover:border-indigo-400 hover:text-indigo-600"
              >
                <Plus className="h-4 w-4" weight="bold" />
              </button>
            </span>
            <Button variant="ghost" onClick={addStep} className="-ml-2">
              Add step
            </Button>
          </li>
        </ol>
      </StepBody>

      <WizardFooter step={2} onBack={() => setStep(1)} hint={`${steps.length} touchpoints over ${totalDays} days`}>
        <Button variant="primary" onClick={() => setStep(3)}>
          Continue
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Button>
      </WizardFooter>
    </>
  );
}
