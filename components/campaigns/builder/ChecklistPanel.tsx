import { CheckCircle, Warning, XCircle } from "@phosphor-icons/react/ssr";
import type { ReadinessView } from "@/lib/domain/campaigns/views";
import type { Section } from "@/lib/domain/campaigns/readiness";

/** Rail recap: how many will be enrolled and what's left before this can go out. Clicking an item jumps to its step. */
export default function ChecklistPanel({ readiness, onGoTo }: { readiness: ReadinessView; onGoTo: (s: Section) => void }) {
  const { blockers, warnings, willEnroll } = readiness;
  return (
    <div className="mt-8 hidden border-t border-neutral-200/80 pt-5 lg:block" aria-label="Launch checklist">
      <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">This campaign</p>
      <p className="text-xs text-neutral-400">Will enroll</p>
      <p className="mt-0.5 text-[22px] font-semibold leading-7 tracking-tight text-neutral-900 tabular-nums">{willEnroll.toLocaleString()}</p>
      <p className="text-xs text-neutral-400">lead{willEnroll === 1 ? "" : "s"} after exclusions and limits</p>

      <div className="mt-5">
        {blockers.length === 0 ? (
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
            <CheckCircle className="h-4 w-4" weight="fill" /> Ready to submit for approval
          </p>
        ) : (
          <>
            <p className="mb-2 text-[13px] font-medium text-neutral-900">{blockers.length} thing{blockers.length === 1 ? "" : "s"} to fix</p>
            <ul className="space-y-2">
              {blockers.map((b, i) => (
                <li key={i}>
                  <button type="button" onClick={() => onGoTo(b.section)} className="flex items-start gap-1.5 text-left text-xs leading-relaxed text-rose-700 hover:underline">
                    <XCircle className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" /> {b.message}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="mt-5 border-t border-neutral-200/80 pt-4">
          <p className="mb-2 text-xs text-neutral-400">Worth a look</p>
          <ul className="space-y-2">
            {warnings.slice(0, 6).map((w, i) => (
              <li key={i}>
                <button type="button" onClick={() => onGoTo(w.section)} className="flex items-start gap-1.5 text-left text-xs leading-relaxed text-amber-800 hover:underline">
                  <Warning className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" /> {w.message}
                </button>
              </li>
            ))}
          </ul>
          {warnings.length > 6 && <p className="mt-1.5 text-xs text-neutral-400">+{warnings.length - 6} more</p>}
        </div>
      )}
    </div>
  );
}
