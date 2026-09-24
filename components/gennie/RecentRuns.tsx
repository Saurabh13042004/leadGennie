import Link from "next/link";
import { MessageSquare } from "lucide-react";
import type { RecentRun } from "@/lib/domain/gennie/view";
import { RUN_STATUS } from "./status";

export default function RecentRuns({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section aria-labelledby="recent-runs-title">
      <h2 id="recent-runs-title" className="mb-2 text-xs font-bold uppercase tracking-wider text-neutral-400">
        Recent
      </h2>
      <div className="flex flex-col gap-1.5">
        {runs.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/gennie/${r.id}`}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <MessageSquare className="h-3.5 w-3.5" />
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-neutral-800">{r.prompt}</span>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${RUN_STATUS[r.status].tone}`}>
              {RUN_STATUS[r.status].label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
