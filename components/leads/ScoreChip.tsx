import { cn } from "@/lib/utils";

/** ICP score at a glance. `null` = never researched (never shown as 0 — that would be an invented number). */
export default function ScoreChip({ score, qualified, className }: { score: number | null; qualified?: boolean | null; className?: string }) {
  if (score === null) return <span className={cn("text-neutral-600", className)} title="Not researched yet">—</span>;
  const tone =
    score >= 80 ? "bg-green-500/10 text-green-300 border-green-500/25"
    : score >= 60 ? "bg-yellow-500/10 text-yellow-200 border-yellow-500/25"
    : "bg-white/5 text-neutral-300 border-white/10";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums font-medium", tone, className)}
      title={qualified ? `ICP score ${score} — meets your qualification threshold` : `ICP score ${score}`}
    >
      {score}
      {qualified && <span aria-label="qualified" className="w-1.5 h-1.5 rounded-full bg-green-400" />}
    </span>
  );
}
