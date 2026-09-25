"use client";

import { useState, useTransition } from "react";
import { CheckCircle, LockKey } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { saveWorkspaceTone } from "@/lib/actions/personalization";
import { TONES, type Tone } from "@/lib/domain/personalization/types";
import { TONE_GUIDANCE } from "@/lib/domain/personalization/tone";
import { Section } from "@/components/ui/Card";
import { Spinner } from "./bits";

export default function ToneSetting({ initial, canEdit }: { initial: Tone; canEdit: boolean }) {
  const [tone, setTone] = useState<Tone>(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function save(next: Tone) {
    setTone(next);
    setMessage(null);
    start(async () => {
      const res = await saveWorkspaceTone(next);
      setMessage(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: res.error.message });
    });
  }

  return (
    <Section
      title={<span id="tone-heading">Email tone</span>}
      description="The default voice for generated emails. You can override it for any single email. Saves as soon as you pick one."
    >
      <div role="radiogroup" aria-label="Email tone" className="grid gap-2 sm:grid-cols-2">
        {TONES.map((t) => {
          const on = tone === t;
          return (
            <button
              key={t} type="button" role="radio" aria-checked={on} disabled={!canEdit || pending} onClick={() => save(t)}
              className={cn(
                "group flex items-start gap-2.5 rounded-lg px-3 py-2.5 text-left ring-1 ring-inset transition-all disabled:cursor-not-allowed",
                on ? "bg-indigo-50/60 ring-2 ring-indigo-500/70" : "bg-white ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
                !canEdit && !on && "opacity-60",
              )}
            >
              <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset", on ? "bg-indigo-600 ring-indigo-600" : "bg-white ring-neutral-300")}>
                {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium capitalize text-neutral-900">{t}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{TONE_GUIDANCE[t].replace(/^Tone: \w+\. /, "")}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex min-h-5 items-center gap-1.5 text-[13px]" role="status">
        {pending && <Spinner className="h-3.5 w-3.5 text-neutral-400" />}
        {message && (
          <span className={message.ok ? "inline-flex items-center gap-1.5 text-emerald-700" : "text-rose-600"}>
            {message.ok && <CheckCircle className="h-4 w-4" weight="fill" />}
            {message.text}
          </span>
        )}
        {!canEdit && (
          <span className="inline-flex items-center gap-1.5 text-neutral-500">
            <LockKey className="h-4 w-4 text-neutral-400" weight="duotone" />
            <span>Only workspace owners and admins can change this.</span>
          </span>
        )}
      </div>
    </Section>
  );
}
