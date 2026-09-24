import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import type { Checklist } from "@/lib/domain/workspace/onboarding";
import DismissButton from "./DismissButton";

/**
 * Setup checklist for the Command Center. Every tick is computed from real
 * workspace state (see lib/domain/workspace/onboarding.ts) — there is no
 * stored "progress" that could be wrong.
 */
export default function OnboardingChecklist({ checklist, canDismiss }: { checklist: Checklist; canDismiss: boolean }) {
  return (
    <section aria-label="Setup checklist" className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-white font-semibold text-sm">Get set up</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {checklist.completed} of {checklist.total} done — this is what LeadGennie needs to write outreach that&apos;s actually about your prospects.
          </p>
        </div>
        {canDismiss && <DismissButton />}
      </div>

      <div className="h-1.5 rounded-full bg-white/10 mt-3 overflow-hidden" aria-hidden>
        <div className="h-full bg-blue-400" style={{ width: `${(checklist.completed / checklist.total) * 100}%` }} />
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {checklist.steps.map((step) => (
          <li key={step.id}>
            <Link
              href={step.href}
              className="flex items-start gap-3 rounded-lg border border-white/10 bg-[#0A0A0A] px-3 py-2.5 hover:bg-white/[0.04] transition-colors"
            >
              {step.done ? <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" /> : <Circle className="w-4 h-4 text-neutral-600 mt-0.5 shrink-0" />}
              <span className="min-w-0">
                <span className={step.done ? "block text-sm text-neutral-500 line-through" : "block text-sm text-white"}>{step.title}</span>
                {!step.done && <span className="block text-xs text-neutral-500 mt-0.5">{step.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
