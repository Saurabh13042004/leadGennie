"use client";

import { useState } from "react";
import { CircleNotch, Hourglass, Plus } from "@phosphor-icons/react/ssr";
import { saveCampaignSteps } from "@/lib/actions/campaign-builder";
import { generateSequenceStepMessage } from "@/lib/actions/ai";
import { isContentEditable, isStructureEditable } from "@/lib/domain/campaigns/state-machine";
import { MAX_STEPS } from "@/lib/domain/campaigns/types";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { inputClasses } from "@/components/ui/Field";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import StepCard, { type StepDraft } from "./StepCard";
import { Notice, SaveMessage } from "./ui";
import { useSave } from "./useSave";

const fromView = (v: BuilderView): StepDraft[] => v.campaign.steps.map((s) => ({ id: s.id, waitDays: s.waitDays, subject: s.subject, body: s.body, mode: s.mode }));

/**
 * The sequence as a timeline. Follow-ups are threaded replies ("Re: <first subject>"), so only the first email has a
 * subject. After approval: no adding/removing/retiming; copy of emails that haven't gone out stays editable.
 */
export default function SequenceSection({ view, canEdit, onSaved, nav }: { view: BuilderView; canEdit: boolean; onSaved: (v: BuilderView) => void; nav: BuilderNav }) {
  const c = view.campaign;
  const structural = canEdit && isStructureEditable(c.status);
  const copyEditable = canEdit && isContentEditable(c.status);
  const locked = new Set(view.lockedStepIds);
  const [steps, setSteps] = useState<StepDraft[]>(fromView(view));
  const [writing, setWriting] = useState<number | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const { pending, message, save } = useSave((v) => {
    onSaved(v);
    setSteps(fromView(v));
  });
  const update = (i: number, patch: Partial<StepDraft>) => setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      [next[i], next[i + dir]] = [next[i + dir], next[i]];
      // Whichever email ends up first carries the subject and sends on day 0.
      return next.map((s, j) => ({ ...s, waitDays: j === 0 ? 0 : s.waitDays || 3, subject: j === 0 ? s.subject || prev[0].subject : "", mode: j === 0 ? s.mode : "template" }));
    });
  const remove = (i: number) => setSteps((p) => p.filter((_, j) => j !== i).map((x, j) => (j === 0 ? { ...x, waitDays: 0 } : x)));
  const days = steps.reduce<number[]>((acc, s, i) => [...acc, i === 0 ? 0 : acc[i - 1] + s.waitDays], []);

  async function aiWrite(i: number) {
    setWriting(i);
    setAiError(null);
    try {
      const d = await generateSequenceStepMessage({ channel: "email", stepIndex: i, audienceLabel: c.audience.source === "segment" ? "the selected segment" : "our leads", campaignName: c.name });
      update(i, { body: d.body, ...(i === 0 ? { subject: d.subject ?? "" } : {}) });
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "Could not write this email.");
    } finally {
      setWriting(null);
    }
  }

  return (
    <>
      <StepBody title="Write the sequence" description={<>Each email sends after its wait. Use <code className="rounded bg-neutral-100 px-1 text-[12px]">{"{{first_name}}"}</code> and <code className="rounded bg-neutral-100 px-1 text-[12px]">{"{{company}}"}</code>; the unsubscribe footer is added automatically.</>}>
        {aiError && <Notice tone="error">{aiError}</Notice>}
        {c.status === "ready" && copyEditable && <Notice tone="warn">Saving changes sends this campaign back to draft — it will need approval again.</Notice>}
        <ol className="relative">
          <span aria-hidden className="absolute bottom-4 left-4 top-4 w-px -translate-x-1/2 bg-neutral-200" />
          {steps.map((s, idx) => (
            <li key={s.id ?? `new-${idx}`} className="relative">
              {idx > 0 && (
                <div className="flex items-center gap-3 py-3 sm:gap-4">
                  <span className="relative flex w-8 shrink-0 justify-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-neutral-400 ring-1 ring-inset ring-neutral-200">
                      <Hourglass className="h-3 w-3" weight="duotone" />
                    </span>
                  </span>
                  <label className="flex items-center gap-2 text-xs text-neutral-500">
                    Wait
                    <input type="number" min={0} max={90} value={s.waitDays} disabled={!structural} onChange={(e) => update(idx, { waitDays: Number(e.target.value) })}
                      className={cn(inputClasses, "h-7 w-14 px-2 text-center text-xs tabular-nums")} />
                    days, then
                  </label>
                </div>
              )}
              <div className="flex gap-3 sm:gap-4">
                <span className="relative flex w-8 shrink-0 justify-center pt-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold tabular-nums text-white shadow-[0_0_0_4px_#fff]">{idx + 1}</span>
                </span>
                <StepCard
                  step={s} idx={idx} day={days[idx]} locked={s.id !== null && locked.has(s.id)} structural={structural} copyEditable={copyEditable}
                  aiLoading={writing === idx} canRemove={steps.length > 1} isLast={idx === steps.length - 1}
                  onChange={(p) => update(idx, p)} onWrite={() => aiWrite(idx)} onRemove={() => remove(idx)} onMove={(d) => move(idx, d)}
                />
              </div>
            </li>
          ))}
        </ol>
        {structural && steps.length < MAX_STEPS && (
          <div className="flex gap-3 sm:gap-4">
            <span className="w-8 shrink-0" />
            <Button variant="secondary" onClick={() => setSteps((p) => [...p, { id: null, waitDays: 3, subject: "", body: "", mode: "template" }])}>
              <Plus className="h-4 w-4" weight="bold" /> Add follow-up
            </Button>
          </div>
        )}
      </StepBody>

      <BuilderFooter nav={nav} hint={`${steps.length} email${steps.length === 1 ? "" : "s"} over ${days[days.length - 1] ?? 0} days`}>
        <SaveMessage message={message} />
        {copyEditable && (
          <Button variant="primary" disabled={pending} onClick={() => save(() => saveCampaignSteps(c.id, steps.map(({ waitDays, subject, body, mode }) => ({ waitDays, subject, body, mode }))))}>
            {pending && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />} Save
          </Button>
        )}
      </BuilderFooter>
    </>
  );
}
