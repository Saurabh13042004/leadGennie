import { cn } from "@/lib/utils";

/** ICP score at a glance. `null` = never researched (never shown as 0 — that would be an invented number). */
export default function ScoreChip({ score, qualified, className }: { score: number | null; qualified?: boolean | null; className?: string }) {
  if (score === null) return <span className={cn("text-neutral-400", className)} title="Not researched yet">—</span>;
  const tone =
    score >= 80 ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
    : score >= 60 ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200"
    : "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200";
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs tabular-nums font-semibold", tone, className)}
      title={qualified ? `ICP score ${score} — meets your qualification threshold` : `ICP score ${score}`}
    >
      {score}
      {qualified && <span aria-label="qualified" className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
    </span>
  );
}
