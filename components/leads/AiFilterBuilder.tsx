"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { generateAiFilter, type AiFilterResult } from "@/lib/actions/leads";

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

  const criteriaChips = result
    ? [
        ...(result.criteria.companies ?? []),
        ...(result.criteria.regions ?? []),
        ...(result.criteria.industries ?? []),
        ...(result.criteria.titles ?? []),
        result.criteria.fundingStage,
        result.criteria.minEmployees
          ? `${result.criteria.minEmployees}${result.criteria.maxEmployees ? `-${result.criteria.maxEmployees}` : "+"} employees`
          : null,
        result.criteria.minRevenueM ? `>$${result.criteria.minRevenueM}M revenue` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
          <Sparkles className="w-4 h-4 text-indigo-600" />
        </div>
        <h3 className="text-sm font-bold text-neutral-900">AI Filter Builder</h3>
      </div>
      <p className="text-xs text-neutral-500 mb-4 ml-[42px]">
        Describe your ideal customer in plain English. AI builds the filter.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="MNC tech companies in India with more than 500 employees and a VP of Engineering"
          className="flex-1 rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="flex items-center justify-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50 shrink-0"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-neutral-400 mb-2">Try:</p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-left text-xs text-neutral-500 hover:text-indigo-600 truncate transition-colors"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-4">{error}</p>}

      {result && (
        <div className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
            <p className="text-sm text-neutral-900 font-semibold">Segment created</p>
            <span className="text-sm text-indigo-700 tabular-nums font-medium">
              {result.estimateMethod === "unmeasurable"
                ? "Not measurable"
                : `${result.estimatedCount.toLocaleString()} matching leads`}
            </span>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            {result.estimateMethod === "measured" &&
              "Measured — counted against your actual leads in this workspace."}
            {result.estimateMethod === "no_matches" &&
              "Measured — no leads in your workspace currently match this criteria."}
            {result.estimateMethod === "unmeasurable" &&
              "The AI couldn't extract a structured filter from this prompt, so there is nothing to count against your leads. Try naming a title, industry, company or location."}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {criteriaChips.length > 0 ? (
              criteriaChips.map((chip) => (
                <span
                  key={chip}
                  className="text-xs text-neutral-700 bg-white border border-neutral-200 rounded-full px-2.5 py-1"
                >
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
