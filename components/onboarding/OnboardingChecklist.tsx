import Link from "next/link";
import { ArrowRight, CheckCircle, Circle } from "@phosphor-icons/react/ssr";
import type { Checklist } from "@/lib/domain/workspace/onboarding";
import { cn } from "@/lib/utils";
import DismissButton from "./DismissButton";

function Ring({ done, total }: { done: number; total: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <div className="relative h-12 w-12 shrink-0">
      <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#eef0ff" strokeWidth="4" />
        <circle cx="22" cy="22" r={r} fill="none" stroke="url(#ring)" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${c * pct} ${c}`} />
        <defs>
          <linearGradient id="ring" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
        </defs>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-neutral-700">
        {done}/{total}
      </span>
    </div>
  );
}

/**
 * Setup checklist for the Command Center. Every tick is computed from real
 * workspace state (see lib/domain/workspace/onboarding.ts) — there is no
 * stored "progress" that could be wrong.
 */
export default function OnboardingChecklist({ checklist, canDismiss }: { checklist: Checklist; canDismiss: boolean }) {
  const next = checklist.steps.find((s) => !s.done);
  return (
    <section aria-label="Setup checklist" className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
      <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-50/70 via-white to-white px-4 py-3.5">
        <Ring done={checklist.completed} total={checklist.total} />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-neutral-900">Finish setting up LeadGennie</h2>
          <p className="mt-0.5 text-[13px] text-neutral-500">This is what LeadGennie needs to write outreach that&apos;s actually about your prospects.</p>
        </div>
        {next && (
          <Link
            href={next.href}
            className="hidden items-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-neutral-800 sm:inline-flex"
          >
            {next.title}
            <ArrowRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        )}
        {canDismiss && <DismissButton />}
      </div>

      <ol className="grid border-t border-neutral-100 sm:grid-cols-2 lg:grid-cols-4">
        {checklist.steps.map((step, i) => (
          <li key={step.id} className={cn("border-neutral-100", i > 0 && "border-t sm:border-t-0", i % 2 === 1 && "sm:border-l", i >= 2 && "sm:border-t lg:border-t-0", i > 0 && "lg:border-l")}>
            <Link href={step.href} className="group flex h-full items-start gap-2.5 px-4 py-3 transition-colors hover:bg-neutral-50">
              {step.done ? (
                <CheckCircle className="mt-px h-[18px] w-[18px] shrink-0 text-emerald-500" weight="fill" />
              ) : (
                <Circle className="mt-px h-[18px] w-[18px] shrink-0 text-neutral-300 group-hover:text-indigo-400" weight="bold" />
              )}
              <span className="min-w-0">
                <span className={cn("block text-[13px] font-medium", step.done ? "text-neutral-400 line-through decoration-neutral-300" : "text-neutral-900")}>{step.title}</span>
                {!step.done && <span className="mt-0.5 block text-xs leading-relaxed text-neutral-500">{step.description}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
