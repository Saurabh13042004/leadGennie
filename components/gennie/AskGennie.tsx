"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Sparkles } from "lucide-react";
import { planGennieRun } from "@/lib/actions/gennie";

/** The Command Center prompt bar. It only PLANS — nothing runs until the user approves on the next screen. */
export default function AskGennie({
  suggestions,
  leadCount,
  canPlan,
  engineAvailable,
}: {
  suggestions: string[];
  leadCount: number;
  canPlan: boolean;
  engineAvailable: boolean;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    const res = await planGennieRun(value);
    if (res.ok) {
      router.push(`/dashboard/gennie/${res.data.runId}`);
      return; // keep the busy state while navigating
    }
    setError(res.error.message);
    setBusy(false);
  }

  return (
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 md:p-6" aria-labelledby="ask-gennie-title">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <h2 id="ask-gennie-title" className="text-sm font-semibold text-white">Ask Gennie</h2>
      </div>
      <p className="text-sm text-neutral-500 mb-4">
        Say what you want done with your leads. Gennie shows a plan first — nothing runs until you approve it, and it never sends email.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(prompt);
        }}
        className="flex flex-col sm:flex-row gap-2"
      >
        <label htmlFor="gennie-prompt" className="sr-only">What should Gennie do?</label>
        <input
          id="gennie-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          disabled={!canPlan || busy}
          placeholder={canPlan ? "e.g. Research my 10 newest unresearched leads" : "You need member access to ask Gennie"}
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canPlan || busy || prompt.trim().length < 3}
          className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {busy ? "Planning…" : "Plan it"}
        </button>
      </form>

      {error && <p role="alert" className="text-sm text-red-400 mt-3">{error}</p>}

      {leadCount === 0 ? (
        <p className="text-xs text-neutral-500 mt-3">
          You have no leads yet — <Link href="/dashboard/leads" className="text-white underline underline-offset-2">add or import some</Link> and Gennie can work on them.
        </p>
      ) : (
        suggestions.length > 0 &&
        canPlan && (
          <div className="flex flex-wrap gap-2 mt-3">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrompt(s);
                  void submit(s);
                }}
                className="text-xs text-neutral-300 border border-white/10 rounded-full px-3 py-1.5 hover:bg-white/5 hover:text-white transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )
      )}
      {!engineAvailable && leadCount > 0 && (
        <p className="text-xs text-amber-300/80 mt-3">The research engine isn&apos;t configured, so Gennie can select and rank leads but not research them.</p>
      )}
    </section>
  );
}
