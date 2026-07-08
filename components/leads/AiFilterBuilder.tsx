"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { generateAiFilter, type AiFilterResult } from "@/lib/actions/leads";

const EXAMPLES = [
  "MNC tech companies in India with more than 500 employees and a VP of Engineering",
  "Series A funded SaaS founders in the US (last 12 months)",
  "CTOs at fintech companies in EMEA with 100-1000 employees",
  "Decision makers at e-commerce brands doing >$10M revenue",
];

export default function AiFilterBuilder() {
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate filter");
    } finally {
      setLoading(false);
    }
  }

  const criteriaChips = result
    ? [
        ...result.criteria.regions,
        ...result.criteria.industries,
        ...result.criteria.titles,
        result.criteria.fundingStage,
        result.criteria.minEmployees
          ? `${result.criteria.minEmployees}${result.criteria.maxEmployees ? `-${result.criteria.maxEmployees}` : "+"} employees`
          : null,
        result.criteria.minRevenueM ? `>$${result.criteria.minRevenueM}M revenue` : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-medium text-white">AI Filter Builder</h3>
      </div>
      <p className="text-xs text-neutral-500 mb-4">
        Describe your ideal customer in plain English. AI builds the filter.
      </p>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
          placeholder="MNC tech companies in India with more than 500 employees and a VP of Engineering"
          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <button
          onClick={handleGenerate}
          disabled={loading || !prompt.trim()}
          className="flex items-center justify-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 shrink-0"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate
        </button>
      </div>

      <div className="mt-4">
        <p className="text-xs text-neutral-600 mb-2">Try:</p>
        <div className="flex flex-col gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setPrompt(ex)}
              className="text-left text-xs text-neutral-400 hover:text-white truncate transition-colors"
              title={ex}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-4">{error}</p>}

      {result && (
        <div className="mt-5 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <p className="text-sm text-white font-medium">Segment created</p>
            <span className="text-sm text-blue-300 tabular-nums">
              ≈ {result.estimatedCount.toLocaleString()} matching leads
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {criteriaChips.length > 0 ? (
              criteriaChips.map((chip) => (
                <span
                  key={chip}
                  className="text-xs text-neutral-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1"
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
