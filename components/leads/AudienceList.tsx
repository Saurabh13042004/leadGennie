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
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-16 px-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
          <Users2 className="w-6 h-6 text-indigo-500" />
        </div>
        <p className="text-neutral-900 font-semibold">No audiences yet</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          Describe your ideal customer above — every audience you build is saved here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}
      {items.map((s) => {
        const chips = [
          ...(s.criteria.companies ?? []),
          ...(s.criteria.regions ?? []),
          ...(s.criteria.industries ?? []),
          ...(s.criteria.titles ?? []),
          s.criteria.fundingStage,
          s.criteria.minEmployees
            ? `${s.criteria.minEmployees}${s.criteria.maxEmployees ? `-${s.criteria.maxEmployees}` : "+"} employees`
            : null,
          s.criteria.minRevenueM ? `>$${s.criteria.minRevenueM}M revenue` : null,
        ].filter(Boolean) as string[];

        return (
          <div key={s.id} className="rounded-2xl border border-neutral-200 bg-white p-4 hover:border-neutral-300 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0 mt-0.5">
                  <Users2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-neutral-900 font-semibold truncate">{s.name}</p>
                  {s.prompt && <p className="text-xs text-neutral-500 mt-0.5 truncate">&quot;{s.prompt}&quot;</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-sm tabular-nums font-medium ${
                    s.estimateMethod === "measured" ? "text-indigo-700" : "text-neutral-400"
                  }`}
                >
                  {countLabel(s)}
                </span>
                {canManage && (
                  <button
                    onClick={() => handleDelete(s.id)}
                    disabled={busyId === s.id}
                    className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
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
              <div className="flex flex-wrap gap-1.5 mt-3 ml-11">
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-full px-2.5 py-1"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-neutral-400 mt-3 ml-11">Free-text segment — no structured criteria detected.</p>
            )}
            <p className="text-[11px] text-neutral-400 mt-2 ml-11">Created {new Date(s.createdAt).toLocaleDateString()}</p>
          </div>
        );
      })}
    </div>
  );
}
