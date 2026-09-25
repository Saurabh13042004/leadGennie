import { CaretRight, EyeSlash } from "@phosphor-icons/react/ssr";
import type { SignalView } from "@/lib/intelligence/read-model";

/** Things the engine found but could NOT verify. Shown for transparency, collapsed, and never used anywhere. */
export default function UnverifiedPanel({ signals }: { signals: SignalView[] }) {
  if (signals.length === 0) return null;
  return (
    <details className="group rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[13px] text-neutral-500 transition-colors hover:text-neutral-900 [&::-webkit-details-marker]:hidden">
        <EyeSlash className="h-4 w-4 text-neutral-400" weight="duotone" />
        <span>Unverified — not used ({signals.length})</span>
        <CaretRight className="ml-auto h-3.5 w-3.5 text-neutral-400 transition-transform group-open:rotate-90" weight="bold" />
      </summary>
      <div className="border-t border-dashed border-neutral-200 px-4 pb-3 pt-2.5">
        <p className="text-xs text-neutral-500">These could not be confirmed against a source. They do not affect the score, the research summary or any message.</p>
        <ul className="mt-2 divide-y divide-neutral-200/70">
          {signals.map((s) => (
            <li key={s.id} className="py-2 text-[13px]">
              <p className="text-neutral-600 line-through decoration-neutral-300">{s.title}</p>
              {s.evidence.flatMap((e) => e.notes).slice(0, 2).map((n, i) => <p key={i} className="mt-0.5 text-xs text-neutral-500">Why not verified: {n}</p>)}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
