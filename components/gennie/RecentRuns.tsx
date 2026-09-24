import Link from "next/link";
import type { RecentRun } from "@/lib/domain/gennie/view";
import { RUN_STATUS } from "./status";

export default function RecentRuns({ runs }: { runs: RecentRun[] }) {
  if (runs.length === 0) return null;
  return (
    <section className="rounded-xl border border-white/10 bg-[#0A0A0A]" aria-labelledby="recent-runs-title">
      <h2 id="recent-runs-title" className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">Recent Gennie runs</h2>
      <ul className="divide-y divide-white/5">
        {runs.map((r) => (
          <li key={r.id}>
            <Link href={`/dashboard/gennie/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
              <span className="text-sm text-neutral-200 truncate">{r.prompt}</span>
              <span className={`shrink-0 text-[11px] border rounded-full px-2 py-0.5 ${RUN_STATUS[r.status].tone}`}>{RUN_STATUS[r.status].label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
