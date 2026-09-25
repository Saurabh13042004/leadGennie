"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { TONE } from "@/components/ui/Badge";
import type { PromptVersion } from "@/lib/actions/prompts";
import VersionEditor from "./VersionEditor";
import { statusMeta } from "./meta";

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
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-xs font-medium text-neutral-500">Versions</p>
        <div role="tablist" aria-label="Version history" className="flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-neutral-100 p-0.5 ring-1 ring-inset ring-neutral-200/60">
          {versions.map((v) => {
            const on = selected?.id === v.id;
            const s = statusMeta(v.status);
            return (
              <button
                key={v.id}
                role="tab"
                aria-selected={on}
                title={s.label}
                onClick={() => setSelectedId(v.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-medium transition-all",
                  on ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-neutral-200/80" : "text-neutral-500 hover:text-neutral-800",
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE[s.tone].dot, v.status === "deprecated" && "opacity-40")} />v{v.versionNumber}
                <span className="hidden text-[11px] font-normal text-neutral-400 sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && <VersionEditor key={selected.id} version={selected} canManage={canManage} canApprove={canApprove} />}
    </div>
  );
}
