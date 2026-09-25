import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import type { RecentRun } from "@/lib/domain/gennie/view";
import { TONE } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { RUN_STATUS, timeAgo } from "./status";

/** A quiet history list — status dot, the prompt, when. */
export default function RecentRuns({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) return null;
  const now = Date.now();
  return (
    <section aria-labelledby="recent-runs-title">
      <h2 id="recent-runs-title" className="mb-1.5 px-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        Recent
      </h2>
      <ul className="flex flex-col">
        {runs.map((r) => {
          const s = RUN_STATUS[r.status];
          return (
            <li key={r.id}>
              <Link
                href={`/dashboard/gennie/${r.id}`}
                className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-neutral-100/70"
              >
                <span className="relative flex h-2 w-2 shrink-0" title={s.label}>
                  {s.pulse && <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-50", TONE[s.tone].dot)} />}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", TONE[s.tone].dot)} />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-700 group-hover:text-neutral-900">{r.prompt}</span>
                <span className={cn("hidden shrink-0 text-[12px] sm:inline", r.status === "awaiting_approval" ? "text-amber-600" : "text-neutral-400")}>
                  {s.label}
                </span>
                <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-neutral-400">{timeAgo(r.createdAt, now)}</span>
                <CaretRight className="h-3 w-3 shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" weight="bold" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
