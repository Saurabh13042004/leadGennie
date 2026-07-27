"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PromptVersion } from "@/lib/actions/prompts";
import VersionEditor from "./VersionEditor";

const STATUS_DOT: Record<string, string> = {
  draft: "bg-neutral-500",
  pending_approval: "bg-purple-400",
  published: "bg-green-400",
  deprecated: "bg-neutral-600",
  rejected: "bg-red-400",
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
        <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Version history</p>
        {versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setSelectedId(v.id)}
            className={cn(
              "w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              selectedId === v.id ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
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
