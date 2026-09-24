import ScoreChip from "@/components/leads/ScoreChip";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

export default function ScoreHeader({ intel }: { intel: LeadIntelligence }) {
  const confidence = intel.research?.icpConfidence;
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">ICP fit</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-5xl font-extrabold text-neutral-900 tabular-nums leading-none tracking-tight">{intel.icpScore ?? "—"}</span>
        <span className="pb-1 text-sm text-neutral-500">/ 100</span>
        {intel.qualified !== null && (
          <span className={intel.qualified ? "ml-auto text-xs font-medium rounded-full px-2.5 py-1 bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200" : "ml-auto text-xs font-medium rounded-full px-2.5 py-1 bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200"}>
            {intel.qualified ? "Qualified" : "Below threshold"}
          </span>
        )}
      </div>
      {confidence !== null && confidence !== undefined && (
        <p className="mt-2 text-xs text-neutral-500" title="Criteria we couldn't verify count as unknown, not as misses — they lower confidence, never the score.">
          Confidence {Math.round(confidence * 100)}%{confidence < 0.7 ? " — some criteria are unknown" : ""}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        Intent <ScoreChip score={intel.intentScore} />
        {intel.researchedAt && <span className="ml-auto text-neutral-400">Researched {new Date(intel.researchedAt).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
