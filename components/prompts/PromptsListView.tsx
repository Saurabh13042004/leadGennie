"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptSummary } from "@/lib/actions/prompts";
import NewPromptModal from "./NewPromptModal";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200",
  pending_approval: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  published: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  deprecated: "bg-neutral-100 text-neutral-400 ring-1 ring-inset ring-neutral-200",
  rejected: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending approval",
  published: "Published",
  deprecated: "Deprecated",
  rejected: "Rejected",
};

export default function PromptsListView({ prompts, canCreate }: { prompts: PromptSummary[]; canCreate: boolean }) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="flex justify-end mb-4">
        {canCreate && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New prompt
          </button>
        )}
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-neutral-900 font-semibold">No prompts yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Build a reusable, versioned prompt — draft it, test it against the model, then submit for approval
            before it can be published.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {prompts.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/ai-prompts/${p.id}`}
              className="rounded-2xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 hover:shadow-sm transition-all flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-neutral-900 font-semibold truncate">{p.name}</p>
                  <p className="text-xs text-neutral-500 capitalize mt-0.5">{p.type.replace("_", " ")}</p>
                </div>
                {p.publishedVersion && (
                  <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-700 shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />v{p.publishedVersion}
                  </span>
                )}
              </div>
              {p.latestStatus && (
                <span
                  className={cn(
                    "self-start text-xs font-medium rounded-full px-2.5 py-1",
                    STATUS_STYLES[p.latestStatus]
                  )}
                >
                  Latest: v{p.latestVersion} · {STATUS_LABEL[p.latestStatus]}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}

      {modalOpen && <NewPromptModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
