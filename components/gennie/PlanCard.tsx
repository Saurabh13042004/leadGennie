import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import type { Plan } from "@/lib/agent/types";

/** What Gennie understood and what it can't do — shown BEFORE anything runs. */
export default function PlanCard({ plan }: { plan: Plan }) {
  const has = (l: unknown[]) => l.length > 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-800"><span className="text-neutral-400">Goal: </span>{plan.goal}</p>

      {has(plan.unsupported) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Gennie can&apos;t do this part yet</p>
          <ul className="text-xs text-amber-700/90 list-disc pl-5 space-y-0.5">
            {plan.unsupported.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>
      )}

      {has(plan.missingInputs) && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-1"><HelpCircle className="w-3.5 h-3.5" /> Gennie needs to know</p>
          <ul className="text-xs text-indigo-700/90 list-disc pl-5 space-y-0.5">
            {plan.missingInputs.map((m) => <li key={m.key}>{m.question}</li>)}
          </ul>
          <p className="text-xs text-neutral-500 mt-2">Rephrase your request with that detail to get a runnable plan.</p>
        </div>
      )}

      {has(plan.assumptions) && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-500 mb-1"><Info className="w-3.5 h-3.5" /> Assumptions</p>
          <ul className="text-xs text-neutral-500 list-disc pl-5 space-y-0.5">
            {plan.assumptions.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </div>
      )}

      {has(plan.warnings) && (
        <ul className="text-xs text-neutral-500 list-disc pl-5 space-y-0.5">
          {plan.warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
    </div>
  );
}
