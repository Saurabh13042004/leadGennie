"use client";

import { useState } from "react";
import { CircleNotch, Trash, UsersThree } from "@phosphor-icons/react/ssr";
import { deleteSegment, type SegmentSummary } from "@/lib/actions/leads";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { criteriaChips } from "./audience-chips";

function countLabel(s: SegmentSummary) {
  if (s.estimateMethod === "measured") return `${s.leadCount.toLocaleString()} leads`;
  if (s.estimateMethod === "no_matches") return "0 leads";
  return "Not measurable";
}

const th = "px-3 py-2 font-medium";

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

  return (
    <section>
      <div className="flex items-center gap-2 px-4 pb-2 pt-5 md:px-6">
        <h2 className="text-[13px] font-semibold text-neutral-900">Saved audiences</h2>
        <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-neutral-500">{items.length}</span>
      </div>

      {error && <p className="mx-4 mb-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200 md:mx-6">{error}</p>}

      {items.length === 0 ? (
        <EmptyState compact icon={UsersThree} title="No audiences yet" description="Describe your ideal customer above — every audience you build is saved here." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-y border-neutral-200/80 bg-neutral-50/60 text-left text-xs text-neutral-500">
                <th className={cn(th, "pl-4 md:pl-6")}>Audience</th>
                <th className={th}>Criteria</th>
                <th className={cn(th, "text-right")}>Size</th>
                <th className={th}>Created</th>
                <th className="w-12 pr-4 md:pr-6"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((s) => {
                const chips = criteriaChips(s.criteria);
                const busy = busyId === s.id;
                return (
                  <tr key={s.id} className="group transition-colors hover:bg-neutral-50/80">
                    <td className="min-w-[240px] py-2.5 pl-4 pr-3 align-middle md:pl-6">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                          <UsersThree className="h-4 w-4" weight="duotone" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{s.name}</p>
                          {s.prompt && <p className="max-w-[380px] truncate text-xs text-neutral-500" title={s.prompt}>&quot;{s.prompt}&quot;</p>}
                        </div>
                      </div>
                    </td>
                    <td className="min-w-[200px] px-3 py-2.5 align-middle">
                      {chips.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {chips.map((chip) => (
                            <span key={chip} className="inline-flex h-5 items-center rounded-md bg-neutral-100 px-1.5 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200/80">
                              {chip}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400">Free-text segment — no structured criteria detected.</span>
                      )}
                    </td>
                    <td className={cn("whitespace-nowrap px-3 py-2.5 text-right align-middle font-medium tabular-nums", s.estimateMethod === "measured" ? "text-neutral-900" : "text-neutral-400")}>
                      {countLabel(s)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-middle text-xs text-neutral-500">{new Date(s.createdAt).toLocaleDateString()}</td>
                    <td className="py-2.5 pl-2 pr-4 align-middle md:pr-6">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDelete(s.id)}
                          disabled={busy}
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-all hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50",
                            busy ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
                          )}
                          aria-label="Delete audience"
                        >
                          {busy ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <Trash className="h-4 w-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
