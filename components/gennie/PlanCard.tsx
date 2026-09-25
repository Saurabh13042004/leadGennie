import type { ReactNode } from "react";
import { Info, ListChecks, Question, WarningCircle } from "@phosphor-icons/react/ssr";
import type { Plan } from "@/lib/agent/types";
import type { NavIcon } from "@/lib/nav-config";
import { cn } from "@/lib/utils";

function Note({ icon: Icon, title, items, className, iconClass, children }: { icon: NavIcon; title: string; items: string[]; className: string; iconClass: string; children?: ReactNode }) {
  return (
    <div className={cn("rounded-lg px-3 py-2.5", className)}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium">
        <Icon className={cn("h-3.5 w-3.5", iconClass)} weight="fill" /> {title}
      </p>
      <ul className="mt-1 space-y-0.5 pl-5 text-[12px] leading-relaxed">
        {items.map((t) => (
          <li key={t} className="list-disc marker:text-current/40">{t}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}

/**
 * Gennie's proposed plan: steps (passed in as children), what it assumed and what it can't do — shown BEFORE
 * anything runs. `footer` holds the approve / control buttons.
 */
export default function PlanCard({ plan, title, hint, children, footer }: { plan: Plan; title: string; hint?: ReactNode; children?: ReactNode; footer?: ReactNode }) {
  const has = (l: unknown[]) => l.length > 0;
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
        <ListChecks className="h-4 w-4 text-violet-600" weight="duotone" />
        <h3 className="text-[13px] font-semibold text-neutral-900">{title}</h3>
        {plan.steps.length > 0 && (
          <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500">
            {plan.steps.length} {plan.steps.length === 1 ? "step" : "steps"}
          </span>
        )}
        {hint && <span className="ml-auto hidden text-[12px] text-neutral-400 sm:inline">{hint}</span>}
      </div>

      <div className="space-y-4 px-4 py-4">
        {children}

        {(has(plan.unsupported) || has(plan.missingInputs) || has(plan.assumptions) || has(plan.warnings)) && (
          <div className="space-y-2">
            {has(plan.unsupported) && (
              <Note icon={WarningCircle} title="Gennie can't do this part yet" items={plan.unsupported} className="bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/70" iconClass="text-amber-500" />
            )}
            {has(plan.missingInputs) && (
              <Note icon={Question} title="Gennie needs to know" items={plan.missingInputs.map((m) => m.question)} className="bg-violet-50/70 text-violet-800 ring-1 ring-inset ring-violet-200/70" iconClass="text-violet-500">
                <p className="mt-1.5 text-[12px] text-neutral-500">Rephrase your request with that detail to get a runnable plan.</p>
              </Note>
            )}
            {has(plan.assumptions) && <Note icon={Info} title="Assumptions" items={plan.assumptions} className="bg-neutral-50 text-neutral-600" iconClass="text-neutral-400" />}
            {has(plan.warnings) && <Note icon={Info} title="Heads up" items={plan.warnings} className="bg-neutral-50 text-neutral-600" iconClass="text-neutral-400" />}
          </div>
        )}
      </div>

      {footer && <div className="border-t border-neutral-100 bg-neutral-50/60 px-4 py-3">{footer}</div>}
    </div>
  );
}
