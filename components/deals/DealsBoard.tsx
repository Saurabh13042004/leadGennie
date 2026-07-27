"use client";

import { useState } from "react";
import { updateDealStage, type Deal, type Stage } from "@/lib/actions/deals";
import { cn } from "@/lib/utils";

export default function DealsBoard({
  stages,
  deals,
  onChanged,
}: {
  stages: Stage[];
  deals: Deal[];
  onChanged: (updated: Deal[]) => void;
}) {
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverStage, setDragOverStage] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDrop(stageId: number) {
    setDragOverStage(null);
    if (dragId === null) return;
    const deal = deals.find((d) => d.id === dragId);
    if (!deal || deal.stageId === stageId) {
      setDragId(null);
      return;
    }

    const prevStageId = deal.stageId;
    const stage = stages.find((s) => s.id === stageId)!;
    onChanged(
      deals.map((d) =>
        d.id === dragId ? { ...d, stageId, stageName: stage.name, status: stage.isWon ? "won" : stage.isLost ? "lost" : "open" } : d
      )
    );
    setDragId(null);
    setError(null);

    try {
      await updateDealStage(dragId, stageId);
    } catch (e) {
      // Revert on failure (e.g. Won stage requires a value).
      onChanged(
        deals.map((d) => (d.id === dragId ? { ...d, stageId: prevStageId } : d))
      );
      setError(e instanceof Error ? e.message : "Could not move deal");
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const stageDeals = deals.filter((d) => d.stageId === stage.id);
          const totalValue = stageDeals.reduce((acc, d) => acc + d.value, 0);
          return (
            <div
              key={stage.id}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverStage(stage.id);
              }}
              onDragLeave={() => setDragOverStage((s) => (s === stage.id ? null : s))}
              onDrop={() => handleDrop(stage.id)}
              className={cn(
                "w-72 shrink-0 rounded-xl border bg-[#0A0A0A] flex flex-col transition-colors",
                dragOverStage === stage.id ? "border-blue-500/50" : "border-white/10"
              )}
            >
              <div className="px-4 py-3 border-b border-white/10">
                <p className="text-sm font-medium text-white">{stage.name}</p>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  {stageDeals.length} deal{stageDeals.length === 1 ? "" : "s"} · ${totalValue.toLocaleString()}
                </p>
              </div>
              <div className="flex-1 p-2 space-y-2 min-h-[100px]">
                {stageDeals.map((deal) => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => setDragId(deal.id)}
                    className="rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] p-3 cursor-grab active:cursor-grabbing transition-colors"
                  >
                    <p className="text-sm text-white truncate">{deal.name}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-medium text-green-400">${deal.value.toLocaleString()}</span>
                      <span className="text-[11px] text-neutral-500">{deal.probability}%</span>
                    </div>
                    {deal.accountCompany && (
                      <p className="text-[11px] text-neutral-500 truncate mt-1">{deal.accountCompany}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
