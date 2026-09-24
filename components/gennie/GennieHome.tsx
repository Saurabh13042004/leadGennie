import { Sparkles } from "lucide-react";
import type { RecentRun } from "@/lib/domain/gennie/view";
import AskGennie from "./AskGennie";
import RecentRuns from "./RecentRuns";

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
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
          <div className="mb-8 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <Sparkles className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">Ask Gennie</h1>
              <p className="text-sm text-neutral-500">
                Describe what you want done with your leads — Gennie plans it, you approve, then it runs.
              </p>
            </div>
          </div>

          <RecentRuns runs={recent} />
        </div>
      </div>

      <div className="shrink-0 border-t border-neutral-200 bg-white/90 backdrop-blur-md px-4 py-4 md:px-8">
        <div className="mx-auto max-w-3xl">
          <AskGennie suggestions={suggestions} leadCount={leadCount} canPlan={canPlan} engineAvailable={engineAvailable} />
        </div>
      </div>
    </div>
  );
}
