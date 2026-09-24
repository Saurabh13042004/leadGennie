"use client";

import Link from "next/link";
import { Loader2, Workflow as WorkflowIcon } from "lucide-react";
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
    <div className="space-y-6">
      {workflows.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-center gap-2 mb-1">
            <WorkflowIcon className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-medium text-white">Start from a saved workflow</h3>
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
                    ? "border-blue-500/50 bg-blue-500/15 text-white"
                    : "border-white/10 text-neutral-300 hover:bg-white/5"
                )}
              >
                {w.name} · {w.stepCount} step{w.stepCount === 1 ? "" : "s"}
              </button>
            ))}
            {workflowId !== null && (
              <button
                onClick={clearWorkflow}
                disabled={workflowLoading}
                className="text-xs text-neutral-500 hover:text-white px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">Campaign name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={audience?.name ?? "e.g. Q3 outreach to SaaS founders"}
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </div>

      <div>
        <label className="block text-sm text-neutral-300 mb-1.5">
          What do you sell, and why should this audience care?
        </label>
        <p className="text-xs text-neutral-500 mb-2">
          This grounds every AI-written message in your actual pitch instead of generic filler. Saved to your profile
          and reused across campaigns.
        </p>
        <textarea
          value={pitch}
          onChange={(e) => setPitch(e.target.value)}
          rows={3}
          placeholder="e.g. We build an AI code-review tool for engineering teams. Cuts PR review time in half and catches bugs before they hit prod. Best for eng teams 20-200 people shipping fast."
          className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2.5 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-white/20 resize-none"
        />
        {!pitch.trim() && (
          <p className="text-xs text-amber-400/80 mt-1.5">
            Leave this empty and the AI will avoid inventing fake product claims — but the copy will be generic.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-sm font-medium text-white mb-1">Choose your audience</h3>
        <p className="text-xs text-neutral-500 mb-3">Pick a saved segment or build a new one with AI.</p>

        {audiences.length === 0 ? (
          <p className="text-sm text-neutral-500 rounded-lg border border-dashed border-white/15 px-4 py-6 text-center">
            No segments yet.{" "}
            <Link href="/dashboard/leads" className="text-white hover:underline">
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
                  "w-full flex items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors",
                  audienceIdx === i ? "border-blue-500/40 bg-blue-500/10" : "border-white/10 hover:bg-white/5"
                )}
              >
                <div>
                  <p className="text-sm text-white">{a.name}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {a.leadCount.toLocaleString()} leads · {a.updatedLabel}
                  </p>
                </div>
                {audienceIdx === i && <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={continueFromAudience}
          disabled={!audience || savingPitch}
          className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50"
        >
          {savingPitch && <Loader2 className="w-4 h-4 animate-spin" />}
          Continue
        </button>
      </div>
    </div>
  );
}
