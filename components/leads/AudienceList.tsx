"use client";

import { useState } from "react";
import { Trash2, Loader2, Users2 } from "lucide-react";
import { deleteSegment, type SegmentSummary } from "@/lib/actions/leads";

function countLabel(s: SegmentSummary) {
  if (s.estimateMethod === "measured") return `${s.leadCount.toLocaleString()} leads`;
  if (s.estimateMethod === "no_matches") return "0 leads";
  return "Not measurable";
}

export default function AudienceList({
  segments,
  canManage,
}: {
  segments: SegmentSummary[];
  canManage: boolean;
}) {
  const [items, setItems] = useState(segments);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // Re-sync when the server refetches (e.g. after router.refresh() following
  // a new audience being built) without a separate effect.
  const [prevSegments, setPrevSegments] = useState(segments);
  if (segments !== prevSegments) {
    setPrevSegments(segments);
    setItems(segments);
  }

  async function handleDelete(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await deleteSegment(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete audience");
    } finally {
      setBusyId(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-16 px-6">
        <p className="text-white font-medium">No audiences yet</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          Describe your ideal customer above — every audience you build is saved here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
      )}
      {items.map((s) => {
        const chips = [
          ...s.criteria.companies,
          ...s.criteria.regions,
          ...s.criteria.industries,
          ...s.criteria.titles,
          s.criteria.fundingStage,
          s.criteria.minEmployees
            ? `${s.criteria.minEmployees}${s.criteria.maxEmployees ? `-${s.criteria.maxEmployees}` : "+"} employees`
            : null,
          s.criteria.minRevenueM ? `>$${s.criteria.minRevenueM}M revenue` : null,
        ].filter(Boolean) as string[];

        return (
          <div key={s.id} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Users2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-sm text-white font-medium truncate">{s.name}</p>
                </div>
                {s.prompt && <p className="text-xs text-neutral-500 mt-1 truncate">&quot;{s.prompt}&quot;</p>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-sm tabular-nums ${
                    s.estimateMethod === "measured" ? "text-blue-300" : "text-neutral-500"
                  }`}
                >
                  {countLabel(s)}
                </span>
                {canManage && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={busyId === s.id}
                    className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                    aria-label="Delete audience"
                  >
                    {busyId === s.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            {chips.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="text-xs text-neutral-300 bg-white/5 border border-white/10 rounded-full px-2.5 py-1"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-600 mt-3">Free-text segment — no structured criteria detected.</p>
            )}
            <p className="text-[11px] text-neutral-600 mt-2">Created {new Date(s.createdAt).toLocaleDateString()}</p>
          </div>
        );
      })}
    </div>
  );
}
