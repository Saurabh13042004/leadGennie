"use client";

import { ArrowDown, ArrowUp, CircleNotch, EnvelopeSimple, Lock, Sparkle, Trash } from "@phosphor-icons/react/ssr";
import type { StepMode } from "@/lib/domain/campaigns/types";
import { cn } from "@/lib/utils";
import Card from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/NavTabs";
import Badge from "@/components/ui/Badge";

export type StepDraft = { id: number | null; waitDays: number; subject: string; body: string; mode: StepMode };

const iconBtn = "flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-30";

/** Editor card for one email of the sequence (same anatomy as the wizard's step card, email-only). */
export default function StepCard({
  step, idx, day, locked, structural, copyEditable, aiLoading, canRemove, isLast, onChange, onWrite, onRemove, onMove,
}: {
  step: StepDraft;
  idx: number;
  day: number;
  locked: boolean;
  structural: boolean;
  copyEditable: boolean;
  aiLoading: boolean;
  canRemove: boolean;
  isLast: boolean;
  onChange: (patch: Partial<StepDraft>) => void;
  onWrite: () => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const first = idx === 0;
  const editable = copyEditable && !locked;
  return (
    <Card className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-200/70">
          <EnvelopeSimple className="h-4 w-4" weight="duotone" />
        </span>
        <span className="text-[13px] font-medium text-neutral-900">{first ? "First email" : "Follow-up"}</span>
        <span className="text-xs text-neutral-400">{first ? "Day 0" : `Day ${day} · reply in the same thread`}</span>
        {locked && <Badge tone="neutral"><Lock className="h-3 w-3" weight="bold" /> Sent — locked</Badge>}
        <div className="ml-auto flex items-center gap-1">
          {editable && (
            <button type="button" onClick={onWrite} disabled={aiLoading}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-50 to-fuchsia-50 px-2.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200/70 transition-colors hover:from-violet-100 hover:to-fuchsia-100 disabled:opacity-60">
              {aiLoading ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Sparkle className="h-3.5 w-3.5" weight="fill" />}
              {aiLoading ? "Writing…" : "AI write"}
            </button>
          )}
          {structural && (
            <>
              <button type="button" onClick={() => onMove(-1)} disabled={first} aria-label="Move up" className={iconBtn}><ArrowUp className="h-3.5 w-3.5" weight="bold" /></button>
              <button type="button" onClick={() => onMove(1)} disabled={isLast} aria-label="Move down" className={iconBtn}><ArrowDown className="h-3.5 w-3.5" weight="bold" /></button>
              {canRemove && (
                <button type="button" onClick={onRemove} aria-label="Remove step" className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600">
                  <Trash className="h-4 w-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        {first && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Segmented<StepMode>
              options={[{ value: "template", label: "Same for everyone" }, { value: "personalized", label: "Personalised per lead" }]}
              value={step.mode}
              onChange={(m) => structural && onChange({ mode: m })}
            />
            {step.mode === "personalized" && <span className="text-xs text-neutral-500">Uses each lead&apos;s approved email; the text below is the fallback.</span>}
          </div>
        )}
        {first && (
          <Input aria-label="Subject" value={step.subject} disabled={!editable} onChange={(e) => onChange({ subject: e.target.value })} maxLength={200}
            placeholder={step.mode === "personalized" ? "Fallback subject line" : "Subject line"} className="font-medium" />
        )}
        <Textarea aria-label={`Email ${idx + 1} message`} value={step.body} disabled={!editable} onChange={(e) => onChange({ body: e.target.value })} rows={6} maxLength={8000}
          placeholder={aiLoading ? "Generating with AI…" : first && step.mode === "personalized" ? "Fallback message (optional)" : "Write the email, or click AI write"}
          className={cn("resize-y", aiLoading && !step.body && "animate-pulse bg-neutral-50")} />
      </div>
    </Card>
  );
}
