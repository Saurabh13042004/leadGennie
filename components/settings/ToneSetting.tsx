"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { saveWorkspaceTone } from "@/lib/actions/personalization";
import { TONES, type Tone } from "@/lib/domain/personalization/types";
import { TONE_GUIDANCE } from "@/lib/domain/personalization/tone";

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
    <section className="space-y-3" aria-labelledby="tone-heading">
      <div>
        <h2 id="tone-heading" className="text-white font-semibold">Email tone</h2>
        <p className="text-sm text-neutral-500">The default voice for generated emails. You can override it for any single email.</p>
      </div>
      <div role="radiogroup" aria-label="Email tone" className="grid gap-2 sm:grid-cols-2">
        {TONES.map((t) => (
          <button
            key={t} type="button" role="radio" aria-checked={tone === t} disabled={!canEdit || pending} onClick={() => save(t)}
            className={`rounded-lg border px-3 py-2.5 text-left transition-colors disabled:opacity-60 ${tone === t ? "border-emerald-400/50 bg-emerald-400/10" : "border-white/10 hover:bg-white/5"}`}
          >
            <span className="block text-sm font-medium capitalize text-white">{t}</span>
            <span className="mt-0.5 block text-xs text-neutral-500">{TONE_GUIDANCE[t].replace(/^Tone: \w+\. /, "")}</span>
          </button>
        ))}
      </div>
      <div className="h-5 text-sm" role="status">
        {pending && <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />}
        {message && <span className={message.ok ? "inline-flex items-center gap-1.5 text-green-300" : "text-red-400"}>{message.ok && <CheckCircle2 className="h-4 w-4" />}{message.text}</span>}
        {!canEdit && <span className="text-neutral-500">Only workspace owners and admins can change this.</span>}
      </div>
    </section>
  );
}
