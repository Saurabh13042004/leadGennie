"use client";

import { CaretDown, CircleNotch, EnvelopeSimple, LinkedinLogo, Sparkle, Trash } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import Card from "@/components/ui/Card";
import { Input, Textarea, inputClasses } from "@/components/ui/Field";
import type { Channel } from "@/lib/ai/messages";
import type { SequenceStep } from "./types";

/** Editor card for one sequence touchpoint: channel, AI write, remove, subject + body. */
export default function SequenceStepCard({
  step,
  idx,
  day,
  aiLoading,
  canRemove,
  multichannel = false,
  onChange,
  onWrite,
  onRemove,
}: {
  step: SequenceStep;
  idx: number;
  day: number;
  aiLoading: boolean;
  canRemove: boolean;
  /** D-05: LinkedIn DM steps only when LinkedIn automation is enabled. Email-only follow-ups reply in the first email's thread. */
  multichannel?: boolean;
  onChange: (patch: Partial<SequenceStep>) => void;
  onWrite: () => void;
  onRemove: () => void;
}) {
  const isEmail = step.channel === "email";
  const ChannelIcon = isEmail ? EnvelopeSimple : LinkedinLogo;

  return (
    <Card className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-inset", isEmail ? "bg-sky-50 text-sky-600 ring-sky-200/70" : "bg-indigo-50 text-indigo-600 ring-indigo-200/70")}>
          <ChannelIcon className="h-4 w-4" weight="duotone" />
        </span>
        {multichannel ? (
        <div className="relative">
          <select
            aria-label={`Step ${idx + 1} channel`}
            value={step.channel}
            onChange={(e) => onChange({ channel: e.target.value as Channel })}
            className={cn(inputClasses, "h-7 w-auto cursor-pointer appearance-none pl-2.5 pr-7 text-xs font-medium shadow-none")}
          >
            <option value="email">Email</option>
            <option value="linkedin_dm">LinkedIn DM</option>
          </select>
          <CaretDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-neutral-400" weight="bold" />
        </div>
        ) : (
          <span className="text-xs font-medium text-neutral-700">{idx === 0 ? "Email" : "Follow-up email"}</span>
        )}
        <span className="text-xs text-neutral-400">{idx === 0 ? "Send immediately" : `Day ${day}${multichannel ? "" : " · reply in the same thread"}`}</span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={onWrite}
            disabled={aiLoading}
            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-gradient-to-r from-violet-50 to-fuchsia-50 px-2.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200/70 transition-colors hover:from-violet-100 hover:to-fuchsia-100 disabled:opacity-60"
          >
            {aiLoading ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <Sparkle className="h-3.5 w-3.5" weight="fill" />}
            {aiLoading ? "Writing…" : "AI write"}
          </button>
          {canRemove && (
            <button
              type="button"
              onClick={onRemove}
              aria-label="Remove step"
              className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2.5 p-4">
        {isEmail && (multichannel || idx === 0) && (
          <Input
            aria-label={`Step ${idx + 1} subject`}
            value={step.subject ?? ""}
            onChange={(e) => onChange({ subject: e.target.value })}
            placeholder="Subject line"
            className="font-medium"
          />
        )}
        <Textarea
          aria-label={`Step ${idx + 1} message`}
          value={step.body}
          onChange={(e) => onChange({ body: e.target.value })}
          rows={isEmail ? 6 : 3}
          placeholder={aiLoading ? "Generating with AI…" : "Write a message or click AI write"}
          className={cn("resize-y", aiLoading && !step.body && "animate-pulse bg-neutral-50")}
        />
      </div>
    </Card>
  );
}
