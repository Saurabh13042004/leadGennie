import type { SignalView } from "@/lib/intelligence/read-model";

/** Things the engine found but could NOT verify. Shown for transparency, collapsed, and never used anywhere. */
export default function UnverifiedPanel({ signals }: { signals: SignalView[] }) {
  if (signals.length === 0) return null;
  return (
    <details className="rounded-2xl border border-neutral-200 bg-white p-5 group">
      <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-900 list-none flex items-center justify-between">
        <span>Unverified — not used ({signals.length})</span>
        <span className="text-xs text-neutral-400 group-open:hidden">Show</span>
      </summary>
      <p className="mt-3 text-xs text-neutral-500">These could not be confirmed against a source. They do not affect the score, the research summary or any message.</p>
      <ul className="mt-3 space-y-3">
        {signals.map((s) => (
          <li key={s.id} className="text-sm">
            <p className="text-neutral-700">{s.title}</p>
            {s.evidence.flatMap((e) => e.notes).slice(0, 2).map((n, i) => <p key={i} className="text-xs text-neutral-500">Why not verified: {n}</p>)}
          </li>
        ))}
      </ul>
    </details>
  );
}
