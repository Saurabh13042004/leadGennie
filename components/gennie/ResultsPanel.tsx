import Link from "next/link";
import type { RunResults } from "@/lib/domain/gennie/view";

const Stat = ({ label, value }: { label: string; value: string | number }) => (
  <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
    <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
    <p className="text-xl font-extrabold tracking-tight text-neutral-900 tabular-nums mt-0.5">{value}</p>
  </div>
);

/** Every number here is counted from the leads table; the model wrote none of it. */
export default function ResultsPanel({ results, final }: { results: RunResults; final: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Leads considered" value={results.considered} />
        <Stat label="Researched" value={results.researched} />
        <Stat label="Qualified" value={results.qualified} />
        <Stat label="Avg ICP score" value={results.avgIcpScore ?? "—"} />
      </div>
      {results.researchFailed > 0 && <p className="text-xs text-rose-600">{results.researchFailed} lead{results.researchFailed === 1 ? "" : "s"} failed research.</p>}

      {results.ranked && results.ranked.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="text-left text-[11px] uppercase tracking-wide text-neutral-400 bg-neutral-50">
              <tr>
                <th className="px-3 py-2 font-bold">#</th>
                <th className="px-3 py-2 font-bold">Lead</th>
                <th className="px-3 py-2 font-bold hidden md:table-cell">Company</th>
                <th className="px-3 py-2 font-bold">ICP</th>
                <th className="px-3 py-2 font-bold hidden md:table-cell">Signals</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {results.ranked.map((r, i) => (
                <tr key={r.leadId}>
                  <td className="px-3 py-2 text-neutral-400 tabular-nums">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/dashboard/leads/${r.leadId}`} className="text-neutral-900 hover:underline">{r.name}</Link>
                    {r.title && <p className="text-xs text-neutral-500">{r.title}</p>}
                  </td>
                  <td className="px-3 py-2 text-neutral-600 hidden md:table-cell">{r.company ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.icpScore === null ? <span className="text-neutral-400 text-xs">Not researched</span> : (
                      <span className={r.qualified ? "text-emerald-600 font-medium" : "text-neutral-700"}>{r.icpScore}{r.qualified ? " · qualified" : ""}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {r.signalTypes.length === 0 ? <span className="text-neutral-300 text-xs">—</span> : r.signalTypes.map((t) => (
                        <span key={t} className="text-[10px] text-neutral-600 border border-neutral-200 rounded-full px-1.5 py-0.5">{t.replace("_", " ").toLowerCase()}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {results.problems.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-neutral-500 mb-1">Skipped or failed</p>
          <ul className="text-xs text-neutral-500 space-y-0.5">
            {results.problems.map((p) => (
              <li key={`${p.leadId}-${p.reason}`}><Link href={`/dashboard/leads/${p.leadId}`} className="text-neutral-700 hover:underline">{p.name}</Link> — {p.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        {final ? "Counted from your leads" : "Counted from your leads so far"} — not written by AI.{" "}
        <Link href="/dashboard/leads?research=researched&sort=icp&dir=desc" className="text-neutral-600 underline underline-offset-2">Open researched leads</Link>
      </p>
    </div>
  );
}
