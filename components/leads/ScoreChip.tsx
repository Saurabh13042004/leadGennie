import { SealCheck } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";

/** ICP score at a glance. `null` = never researched (never shown as 0 — that would be an invented number). */
export default function ScoreChip({ score, qualified, className }: { score: number | null; qualified?: boolean | null; className?: string }) {
  if (score === null) return <span className={cn("text-[13px] text-neutral-300", className)} title="Not researched yet">—</span>;
  const bar = score >= 80 ? "bg-emerald-500" : score >= 60 ? "bg-amber-500" : "bg-neutral-400";
  const text = score >= 80 ? "text-emerald-700" : score >= 60 ? "text-amber-700" : "text-neutral-600";
  return (
    <span
      className={cn("inline-flex items-center gap-2", className)}
      title={qualified ? `ICP score ${score} — meets your qualification threshold` : `ICP score ${score}`}
    >
      <span className={cn("w-6 text-right text-[13px] font-semibold tabular-nums", text)}>{score}</span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-neutral-100">
        <span className={cn("block h-full rounded-full", bar)} style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      {qualified && <SealCheck aria-label="qualified" className="h-3.5 w-3.5 text-emerald-500" weight="fill" />}
    </span>
  );
}
