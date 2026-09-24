"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUp, Loader2 } from "lucide-react";
import { planGennieRun } from "@/lib/actions/gennie";

/** The Ask Gennie composer. It only PLANS — nothing runs until the user approves on the next screen. */
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
    <div>
      {leadCount === 0 ? (
        <p className="text-xs text-neutral-500 mb-2.5">
          You have no leads yet — <Link href="/dashboard/leads" className="text-indigo-600 hover:underline">add or import some</Link> and Gennie can work on them.
        </p>
      ) : (
        suggestions.length > 0 &&
        canPlan && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrompt(s);
                  void submit(s);
                }}
                className="text-xs text-neutral-600 border border-neutral-200 bg-white rounded-full px-3 py-1.5 hover:border-neutral-300 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )
      )}

      {!engineAvailable && leadCount > 0 && (
        <p className="text-xs text-amber-600 mb-2">The research engine isn&apos;t configured, so Gennie can select and rank leads but not research them.</p>
      )}

      {error && <p role="alert" className="text-sm text-rose-600 mb-2">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(prompt);
        }}
        className="flex items-end gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_8px_24px_rgba(20,25,30,0.06)] focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100"
      >
        <label htmlFor="gennie-prompt" className="sr-only">What should Gennie do?</label>
        <input
          id="gennie-prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          maxLength={500}
          disabled={!canPlan || busy}
          placeholder={canPlan ? "Ask Gennie to find, research or rank your leads…" : "You need member access to ask Gennie"}
          className="flex-1 bg-transparent px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!canPlan || busy || prompt.trim().length < 3}
          aria-label="Plan it"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-800 disabled:opacity-40"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
        </button>
      </form>
      <p className="mt-2 text-[11px] text-neutral-400">
        Gennie shows a plan first — nothing runs until you approve it, and it never sends email.
      </p>
    </div>
  );
}
