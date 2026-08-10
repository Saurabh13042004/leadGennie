"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Workflow as WorkflowIcon, Plus, Trash2, Loader2, GitBranch } from "lucide-react";
import { deleteWorkflow, type WorkflowSummary } from "@/lib/actions/workflows";
import type { AudienceOption } from "@/lib/actions/campaigns";
import WorkflowCanvas from "./WorkflowCanvas";

export default function WorkflowsListView({
  initialWorkflows,
  audiences,
}: {
  initialWorkflows: WorkflowSummary[];
  audiences: AudienceOption[];
}) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [building, setBuilding] = useState<{ id: number | null } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function closeBuilder() {
    setBuilding(null);
    router.refresh();
  }

  if (building) {
    return <WorkflowCanvas workflowId={building.id} audiences={audiences} onClose={closeBuilder} />;
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this workflow? Campaigns already launched from it keep their own copy of the steps.")) return;
    setBusyId(id);
    setError(null);
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete workflow");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <WorkflowIcon className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Agentic Flows</h1>
            <p className="text-sm text-neutral-500">
              Build a reusable outreach sequence once — attach it to any campaign.
            </p>
          </div>
        </div>
        <button
          onClick={() => setBuilding({ id: null })}
          className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New workflow
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      {workflows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <GitBranch className="w-8 h-8 text-neutral-600 mb-3" />
          <p className="text-white font-medium">No workflows yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Build a source-plus-steps sequence once, then pick it every time you launch a campaign instead of
            rebuilding it from scratch.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workflows.map((w) => (
            <div key={w.id} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setBuilding({ id: w.id })} className="text-left flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">{w.name}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {w.sourceLabel} · {w.stepCount} step{w.stepCount === 1 ? "" : "s"}
                  </p>
                  <p className="text-[11px] text-neutral-600 mt-2">
                    Updated {new Date(w.updatedAt).toLocaleDateString()}
                  </p>
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  disabled={busyId === w.id}
                  className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50 shrink-0"
                  aria-label="Delete workflow"
                >
                  {busyId === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
