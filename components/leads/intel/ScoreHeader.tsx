import ScoreChip from "@/components/leads/ScoreChip";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

export default function ScoreHeader({ intel }: { intel: LeadIntelligence }) {
  const confidence = intel.research?.icpConfidence;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
      <p className="text-xs uppercase tracking-wider text-neutral-500">ICP fit</p>
      <div className="mt-2 flex items-end gap-3">
        <span className="text-5xl font-semibold text-white tabular-nums leading-none">{intel.icpScore ?? "—"}</span>
        <span className="pb-1 text-sm text-neutral-500">/ 100</span>
        {intel.qualified !== null && (
          <span className={intel.qualified ? "ml-auto text-xs rounded-full px-2.5 py-1 bg-green-500/10 text-green-300 border border-green-500/25" : "ml-auto text-xs rounded-full px-2.5 py-1 bg-white/5 text-neutral-400 border border-white/10"}>
            {intel.qualified ? "Qualified" : "Below threshold"}
          </span>
        )}
      </div>
      {confidence !== null && confidence !== undefined && (
        <p className="mt-2 text-xs text-neutral-500" title="Criteria we couldn't verify count as unknown, not as misses — they lower confidence, never the score.">
          Confidence {Math.round(confidence * 100)}%{confidence < 0.7 ? " — some criteria are unknown" : ""}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-400">
        Intent <ScoreChip score={intel.intentScore} />
        {intel.researchedAt && <span className="ml-auto text-neutral-600">Researched {new Date(intel.researchedAt).toLocaleDateString()}</span>}
      </div>
    </div>
  );
}
