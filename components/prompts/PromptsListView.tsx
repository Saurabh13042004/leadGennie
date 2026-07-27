"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PromptSummary } from "@/lib/actions/prompts";
import NewPromptModal from "./NewPromptModal";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-white/5 text-neutral-400 border-white/10",
  pending_approval: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  published: "bg-green-500/10 text-green-300 border-green-500/20",
  deprecated: "bg-neutral-500/10 text-neutral-500 border-neutral-500/20",
  rejected: "bg-red-500/10 text-red-300 border-red-500/20",
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
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New prompt
          </button>
        )}
      </div>

      {prompts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">No prompts yet</p>
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
              className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5 hover:border-white/20 hover:bg-white/[0.02] transition-colors flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-white font-medium truncate">{p.name}</p>
                  <p className="text-xs text-neutral-500 capitalize">{p.type.replace("_", " ")}</p>
                </div>
                {p.publishedVersion && (
                  <span className="flex items-center gap-1 text-[11px] text-green-400 shrink-0">
                    <BadgeCheck className="w-3.5 h-3.5" />v{p.publishedVersion}
                  </span>
                )}
              </div>
              {p.latestStatus && (
                <span
                  className={cn(
                    "self-start text-xs border rounded-full px-2.5 py-1",
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
