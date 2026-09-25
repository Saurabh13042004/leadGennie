import Link from "next/link";
import { ArrowRight, ChartBar, WarningCircle } from "@phosphor-icons/react/ssr";
import type { RunResults } from "@/lib/domain/gennie/view";
import Avatar from "@/components/ui/Avatar";
import ScoreChip from "@/components/leads/ScoreChip";

function Figure({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">{label}</p>
      <p className={`mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums ${tone ?? "text-neutral-900"}`}>{value}</p>
    </div>
  );
}

/** Every number here is counted from the leads table; the model wrote none of it. */
export default function ResultsPanel({ results, final }: { results: RunResults; final: boolean }) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <ChartBar className="h-4 w-4 text-violet-600" weight="duotone" />
        <h3 className="text-[13px] font-semibold text-neutral-900">{final ? "Results" : "Results so far"}</h3>
        <Link
          href="/dashboard/leads?research=researched&sort=icp&dir=desc"
          className="ml-auto inline-flex items-center gap-1 text-[12px] font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Open researched leads <ArrowRight className="h-3 w-3" weight="bold" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-px border-b border-neutral-100 bg-neutral-100 md:grid-cols-4">
        <Figure label="Leads considered" value={results.considered} />
        <Figure label="Researched" value={results.researched} />
        <Figure label="Qualified" value={results.qualified} tone={results.qualified > 0 ? "text-emerald-600" : undefined} />
        <Figure label="Avg ICP score" value={results.avgIcpScore ?? "—"} />
      </div>

      {results.researchFailed > 0 && (
        <p className="flex items-center gap-1.5 border-b border-neutral-100 bg-rose-50/50 px-4 py-2 text-[12px] text-rose-700">
          <WarningCircle className="h-3.5 w-3.5" weight="fill" />
          {results.researchFailed} lead{results.researchFailed === 1 ? "" : "s"} failed research.
        </p>
      )}

      {results.ranked && results.ranked.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-neutral-50/60 text-left text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="w-10 px-4 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Lead</th>
                <th className="hidden px-2 py-2 font-medium md:table-cell">Company</th>
                <th className="px-2 py-2 font-medium">ICP</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.ranked.map((r, i) => (
                <tr key={r.leadId} className="transition-colors hover:bg-neutral-50/60">
                  <td className="px-4 py-2.5 tabular-nums text-neutral-400">{i + 1}</td>
                  <td className="px-2 py-2.5">
                    <Link href={`/dashboard/leads/${r.leadId}`} className="group flex min-w-0 items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-900 group-hover:underline">{r.name}</span>
                        {r.title && <span className="block truncate text-[12px] text-neutral-500">{r.title}</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="hidden px-2 py-2.5 text-neutral-600 md:table-cell">{r.company ?? "—"}</td>
                  <td className="px-2 py-2.5">
                    {r.icpScore === null ? <span className="text-[12px] text-neutral-400">Not researched</span> : <ScoreChip score={r.icpScore} qualified={r.qualified} />}
                  </td>
                  <td className="hidden px-4 py-2.5 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {r.signalTypes.length === 0 ? (
                        <span className="text-[12px] text-neutral-300">—</span>
                      ) : (
                        r.signalTypes.map((t) => (
                          <span key={t} className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600">
                            {t.replace("_", " ").toLowerCase()}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.problems.length > 0 && (
        <div className="border-t border-neutral-100 px-4 py-3">
          <p className="mb-1.5 text-[12px] font-medium text-neutral-600">Skipped or failed</p>
          <ul className="space-y-1 text-[12px] text-neutral-500">
            {results.problems.map((p) => (
              <li key={`${p.leadId}-${p.reason}`} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                <span>
                  <Link href={`/dashboard/leads/${p.leadId}`} className="font-medium text-neutral-700 hover:underline">{p.name}</Link> — {p.reason}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-2 text-[11px] text-neutral-400">
        {final ? "Counted from your leads" : "Counted from your leads so far"} — not written by AI.
      </p>
    </div>
  );
}
