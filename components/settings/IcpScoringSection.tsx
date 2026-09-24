"use client";

export type ScoringDraft = {
  minScore: string;
  weights: { industry: string; employee_range: string; geography: string; title: string };
  keywords: string;
};

const inputCls =
  "w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-60";

const WEIGHT_LABELS: [keyof ScoringDraft["weights"], string][] = [
  ["industry", "Industry"],
  ["employee_range", "Company size"],
  ["geography", "Location"],
  ["title", "Job title"],
];

/** How the engine scores leads against the ICP above. Weights are relative — they are normalized to 100. */
export default function IcpScoringSection({ value, onChange, canEdit }: { value: ScoringDraft; onChange: (v: ScoringDraft) => void; canEdit: boolean }) {
  return (
    <section id="scoring" className="space-y-4 scroll-mt-20">
      <div>
        <h2 className="text-white font-semibold">Scoring</h2>
        <p className="text-sm text-neutral-500">
          Each lead gets a 0–100 fit score from the criteria above. Criteria we can&apos;t verify count as <em>unknown</em> — they lower confidence, never the score.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {WEIGHT_LABELS.map(([key, label]) => (
          <label key={key} className="block">
            <span className="block text-sm text-neutral-300 mb-1.5">{label} weight</span>
            <input
              type="number" min={0} max={100} inputMode="numeric" disabled={!canEdit} className={inputCls}
              value={value.weights[key]}
              onChange={(e) => onChange({ ...value, weights: { ...value.weights, [key]: e.target.value } })}
            />
          </label>
        ))}
      </div>
      <label className="block">
        <span className="block text-sm text-neutral-300 mb-1.5">Keywords that signal fit</span>
        <input
          disabled={!canEdit} className={inputCls} placeholder="outbound, SDR, sales automation"
          value={value.keywords} onChange={(e) => onChange({ ...value, keywords: e.target.value })}
        />
        <span className="block text-xs text-neutral-600 mt-1">Matched against verified evidence (a company&apos;s own pages, job listings, news). Each adds to the score if found.</span>
      </label>
      <label className="block max-w-[200px]">
        <span className="block text-sm text-neutral-300 mb-1.5">Qualified at score ≥</span>
        <input
          type="number" min={0} max={100} inputMode="numeric" disabled={!canEdit} className={inputCls}
          value={value.minScore} onChange={(e) => onChange({ ...value, minScore: e.target.value })}
        />
      </label>
    </section>
  );
}
