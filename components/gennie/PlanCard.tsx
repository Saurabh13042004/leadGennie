import { AlertTriangle, HelpCircle, Info } from "lucide-react";
import type { Plan } from "@/lib/agent/types";

/** What Gennie understood and what it can't do — shown BEFORE anything runs. */
export default function PlanCard({ plan }: { plan: Plan }) {
  const has = (l: unknown[]) => l.length > 0;
  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-200"><span className="text-neutral-500">Goal: </span>{plan.goal}</p>

      {has(plan.unsupported) && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-amber-300 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Gennie can&apos;t do this part yet</p>
          <ul className="text-xs text-amber-200/80 list-disc pl-5 space-y-0.5">
            {plan.unsupported.map((u) => <li key={u}>{u}</li>)}
          </ul>
        </div>
      )}

      {has(plan.missingInputs) && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-blue-300 mb-1"><HelpCircle className="w-3.5 h-3.5" /> Gennie needs to know</p>
          <ul className="text-xs text-blue-200/80 list-disc pl-5 space-y-0.5">
            {plan.missingInputs.map((m) => <li key={m.key}>{m.question}</li>)}
          </ul>
          <p className="text-xs text-neutral-500 mt-2">Rephrase your request with that detail to get a runnable plan.</p>
        </div>
      )}

      {has(plan.assumptions) && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 mb-1"><Info className="w-3.5 h-3.5" /> Assumptions</p>
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
