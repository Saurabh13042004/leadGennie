"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PromptVersion } from "@/lib/actions/prompts";
import VersionEditor from "./VersionEditor";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-neutral-400",
  pending_approval: "bg-indigo-500",
  published: "bg-emerald-500",
  deprecated: "bg-neutral-300",
  rejected: "bg-rose-500",
};

export default function PromptDetailView({
  versions,
  canManage,
  canApprove,
}: {
  versions: PromptVersion[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const [selectedId, setSelectedId] = useState(versions[0]?.id);
  const selected = versions.find((v) => v.id === selectedId) ?? versions[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
      <div className="space-y-1">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">Version history</p>
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
              selectedId === v.id
                ? "bg-indigo-50 text-indigo-700"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50"
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", STATUS_DOT[v.status])} />v{v.versionNumber}
          </button>
        ))}
      </div>

      {selected && <VersionEditor key={selected.id} version={selected} canManage={canManage} canApprove={canApprove} />}
    </div>
  );
}
