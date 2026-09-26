import { SealCheck } from "@phosphor-icons/react/ssr";
import ScoreChip from "@/components/leads/ScoreChip";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";

/** The ICP score as the headline number, with its threshold state, confidence caveat and the intent score. */
export default function ScoreHeader({ intel }: { intel: LeadIntelligence }) {
  const confidence = intel.research?.icpConfidence;
  const score = intel.icpScore;
  // Most criteria unchecked (no verified evidence yet) ⇒ "below threshold" would read as a verdict on the lead it isn't.
  const thin = confidence !== null && confidence !== undefined && confidence < 0.7;
  const bar = score === null ? "" : score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-neutral-400";
  return (
    <Card className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-neutral-500">ICP fit</p>
        {intel.qualified !== null &&
          (intel.qualified ? (
            <Badge tone="emerald">
              <SealCheck className="h-3 w-3" weight="fill" />
              Qualified
            </Badge>
          ) : (
            <Badge tone={thin ? "amber" : "neutral"}>{thin ? "Needs more evidence" : "Below threshold"}</Badge>
          ))}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[40px] font-semibold leading-none tracking-tight text-neutral-900 tabular-nums">{score ?? "—"}</span>
        <span className="text-[13px] text-neutral-400">/ 100</span>
      </div>
      {score !== null && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
        </div>
      )}
      {confidence !== null && confidence !== undefined && (
        <p className="mt-2 text-xs text-neutral-500" title="Criteria we couldn't verify count as unknown, not as misses — they lower confidence, never the score.">
          Confidence {Math.round(confidence * 100)}%{thin ? " — some criteria are unknown" : ""}
        </p>
      )}
      {thin && intel.qualified === false && (
        <p className="mt-1 text-xs leading-snug text-neutral-500">
          This is only what we could verify — many criteria weren&apos;t checkable yet, so it says little about fit. Run research to fill the gaps.
        </p>
      )}
      <div className="min-h-3 flex-1" />
      <div className="flex items-center gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
        <span>Intent</span>
        <ScoreChip score={intel.intentScore} />
      </div>
    </Card>
  );
}
