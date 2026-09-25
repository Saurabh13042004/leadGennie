import { Sparkle } from "@phosphor-icons/react/ssr";
import type { RecentRun } from "@/lib/domain/gennie/view";
import PageHeader from "@/components/ui/PageHeader";
import AskGennie from "./AskGennie";
import GennieMark from "./GennieMark";
import RecentRuns from "./RecentRuns";

/** Chat-style landing: greeting, one big composer, starter prompts, then a quiet history list. */
export default function GennieHome({
  suggestions,
  recent,
  leadCount,
  engineAvailable,
  canPlan,
}: {
  suggestions: string[];
  recent: RecentRun[];
  leadCount: number;
  engineAvailable: boolean;
  canPlan: boolean;
}) {
  return (
    <div className="relative min-h-full">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(167,139,250,0.10),rgba(232,121,249,0.04)_45%,transparent_75%)]" />
      <PageHeader title="Ask Gennie" icon={Sparkle} description="Plan, approve, run" className="bg-white/70" />

      <div className="relative mx-auto w-full max-w-[720px] px-4 pb-16 pt-12 md:px-6 md:pt-[12vh]">
        <div className="mb-7 flex flex-col items-center text-center">
          <GennieMark size="lg" glow />
          <h2 className="mt-5 text-[26px] font-semibold tracking-tight text-neutral-900 md:text-[30px]">What should we work on?</h2>
          <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-neutral-500">
            Describe what you want done with your leads. Gennie drafts a plan, you approve it, then it runs.
          </p>
        </div>

        <AskGennie suggestions={suggestions} leadCount={leadCount} canPlan={canPlan} engineAvailable={engineAvailable} />

        {recent.length > 0 && (
          <div className="-mx-3 mt-12">
            <RecentRuns runs={recent} />
          </div>
        )}
      </div>
    </div>
  );
}
