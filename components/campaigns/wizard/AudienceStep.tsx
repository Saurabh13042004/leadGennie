"use client";

import Link from "next/link";
import { ArrowRight, Loader2, Workflow as WorkflowIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CampaignDraft } from "./useCampaignDraft";

export default function AudienceStep({ draft }: { draft: CampaignDraft }) {
  const {
    workflows,
    workflowId,
    workflowLoading,
    applyWorkflow,
    clearWorkflow,
    name,
    setName,
    audience,
    audiences,
    audienceIdx,
    setAudienceIdx,
    pitch,
    setPitch,
    savingPitch,
    continueFromAudience,
  } = draft;

  return (
    <div className="space-y-5">
      {workflows.length > 0 && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
          <div className="flex items-center gap-2 mb-1">
            <WorkflowIcon className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-neutral-900">Start from a saved workflow</h3>
          </div>
          <p className="text-xs text-neutral-500 mb-3">
            Pre-fills the audience and sequence below from a workflow built in Agentic Flows — still fully editable
            after.
          </p>
          <div className="flex flex-wrap gap-2">
            {workflows.map((w) => (
              <button
                key={w.id}
                onClick={() => applyWorkflow(w.id)}
                disabled={workflowLoading}
                className={cn(
                  "text-xs rounded-full px-3 py-1.5 border transition-colors disabled:opacity-50",
                  workflowId === w.id
                    ? "border-indigo-300 bg-indigo-100 text-indigo-800"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {w.name} · {w.stepCount} step{w.stepCount === 1 ? "" : "s"}
              </button>
            ))}
            {workflowId !== null && (
              <button
                onClick={clearWorkflow}
                disabled={workflowLoading}
                className="text-xs text-neutral-500 hover:text-neutral-900 px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 space-y-5">
        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Campaign name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={audience?.name ?? "e.g. Q3 outreach to SaaS founders"}
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-neutral-900 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">
            What do you sell, and why should this audience care?
          </label>
          <p className="text-xs text-neutral-500 mb-2">
            This grounds every AI-written message in your actual pitch instead of generic filler. Saved to your
            profile and reused across campaigns.
          </p>
          <textarea
            value={pitch}
            onChange={(e) => setPitch(e.target.value)}
            rows={3}
            placeholder="e.g. We build an AI code-review tool for engineering teams. Cuts PR review time in half and catches bugs before they hit prod. Best for eng teams 20-200 people shipping fast."
            className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-neutral-900 text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
          />
          {!pitch.trim() && (
            <p className="text-xs text-amber-700 mt-1.5">
              Leave this empty and the AI will avoid inventing fake product claims — but the copy will be generic.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-neutral-900 mb-1">Choose your audience</h3>
        <p className="text-xs text-neutral-500 mb-3">Pick a saved segment or build a new one with AI.</p>

        {audiences.length === 0 ? (
          <p className="text-sm text-neutral-500 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-6 text-center">
            No segments yet.{" "}
            <Link href="/dashboard/leads" className="text-indigo-600 hover:text-indigo-700 hover:underline">
              Build one from the Leads page
            </Link>
            .
          </p>
        ) : (
          <div className="space-y-2">
            {audiences.map((a, i) => (
              <button
                key={`${a.id}-${a.name}`}
                onClick={() => setAudienceIdx(i)}
                className={cn(
                  "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  audienceIdx === i
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-neutral-200 hover:bg-neutral-50 hover:border-neutral-300"
                )}
              >
                <div>
                  <p className="text-sm font-medium text-neutral-900">{a.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {a.leadCount.toLocaleString()} leads · {a.updatedLabel}
                  </p>
                </div>
                {audienceIdx === i && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={continueFromAudience}
          disabled={!audience || savingPitch}
          className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {savingPitch && <Loader2 className="w-4 h-4 animate-spin" />}
          Continue
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
