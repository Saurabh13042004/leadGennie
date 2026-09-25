"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, CircleNotch, Sparkle, UsersThree, WarningOctagon } from "@phosphor-icons/react/ssr";
import { generateAiFilter, type AiFilterResult } from "@/lib/actions/leads";
import { Kbd } from "@/components/ui/Field";
import { cn } from "@/lib/utils";
import { AI_TILE } from "./ai-styles";
import { criteriaChips } from "./audience-chips";

const EXAMPLES = [
  "MNC tech companies in India with more than 500 employees and a VP of Engineering",
  "Series A funded SaaS founders in the US (last 12 months)",
  "CTOs at fintech companies in EMEA with 100-1000 employees",
  "Decision makers at e-commerce brands doing >$10M revenue",
];

export default function AiFilterBuilder() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiFilterResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await generateAiFilter(prompt);
      setResult(res);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate filter");
    } finally {
      setLoading(false);
    }
  }

  const chips = result ? criteriaChips(result.criteria) : [];
  const canSubmit = !loading && !!prompt.trim();

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <span className={cn(AI_TILE, "h-8 w-8")}>
          <Sparkle className="h-4 w-4" weight="fill" />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-neutral-900">Build an audience</h2>
          <p className="text-[13px] text-neutral-500">Describe your ideal customer in plain English. AI builds the filter.</p>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-indigo-400/70 via-violet-400/70 to-fuchsia-400/70 p-px shadow-[0_4px_16px_-4px_rgba(124,58,237,0.25)] transition-shadow focus-within:shadow-[0_6px_24px_-4px_rgba(124,58,237,0.4)]">
        <div className="flex items-center gap-2 rounded-[11px] bg-white py-1.5 pl-3.5 pr-1.5">
          <Sparkle className="h-4 w-4 shrink-0 text-violet-500" weight="duotone" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="MNC tech companies in India with more than 500 employees and a VP of Engineering"
            aria-label="Describe your audience"
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
          />
          <Kbd className="hidden sm:inline-flex">↵</Kbd>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canSubmit}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-all",
              canSubmit
                ? "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-[0_1px_2px_rgba(124,58,237,0.35)] hover:from-violet-500 hover:to-fuchsia-500"
                : "bg-neutral-100 text-neutral-400",
            )}
          >
            {loading ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <ArrowUp className="h-4 w-4" weight="bold" />}
            Generate
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-neutral-400">Try</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setPrompt(ex)}
            title={ex}
            className="max-w-[260px] truncate rounded-full bg-white px-2.5 py-1 text-xs text-neutral-600 ring-1 ring-inset ring-neutral-200 transition-colors hover:bg-violet-50 hover:text-violet-700 hover:ring-violet-200"
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200">
          <WarningOctagon className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5 rounded-xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-[13px] font-semibold text-neutral-900">
              <UsersThree className="h-4 w-4 text-violet-500" weight="duotone" />
              Segment created
            </p>
            <span className={cn("text-[13px] font-medium tabular-nums", result.estimateMethod === "measured" ? "text-indigo-700" : "text-neutral-500")}>
              {result.estimateMethod === "unmeasurable" ? "Not measurable" : `${result.estimatedCount.toLocaleString()} matching leads`}
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-500">
            {result.estimateMethod === "measured" && "Measured — counted against your actual leads in this workspace."}
            {result.estimateMethod === "no_matches" && "Measured — no leads in your workspace currently match this criteria."}
            {result.estimateMethod === "unmeasurable" &&
              "The AI couldn't extract a structured filter from this prompt, so there is nothing to count against your leads. Try naming a title, industry, company or location."}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {chips.length > 0 ? (
              chips.map((chip) => (
                <span key={chip} className="rounded-md bg-violet-50 px-2 py-0.5 text-xs text-violet-700 ring-1 ring-inset ring-violet-200/70">
                  {chip}
                </span>
              ))
            ) : (
              <span className="text-xs text-neutral-500">No structured criteria detected — saved as free-text segment.</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
