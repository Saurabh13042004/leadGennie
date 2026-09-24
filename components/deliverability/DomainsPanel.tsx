"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, RefreshCw, ShieldCheck, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshDomain, triggerVerify, removeDomain, type Domain } from "@/lib/actions/domains";
import AddDomainModal from "./AddDomainModal";

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  not_started: "bg-neutral-100 text-neutral-500 ring-1 ring-inset ring-neutral-200",
  failed: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  partially_verified: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  partially_failed: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
};

export default function DomainsPanel({ domains, canAdd, canManage }: { domains: Domain[]; canAdd: boolean; canManage: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleRefresh(id: number) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await refreshDomain(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not refresh");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleVerify(id: number) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await triggerVerify(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not trigger verification");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRemove(id: number) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await removeDomain(id);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not remove domain");
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add domain
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {domains.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <ShieldCheck className="w-10 h-10 text-neutral-300 mb-3" />
          <p className="text-neutral-900 font-semibold">No sending domains yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Add a domain to get real SPF/DKIM/DMARC records from Resend — no email can send until its domain is
            verified.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => {
            const isBusy = busyId === d.id && isPending;
            return (
              <div key={d.id} className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    {expanded === d.id ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                    )}
                    <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="text-sm font-medium text-neutral-900 truncate">{d.name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "text-xs font-medium rounded-full px-2.5 py-1",
                        STATUS_STYLES[d.status] ?? STATUS_STYLES.not_started
                      )}
                    >
                      {d.status.replace(/_/g, " ")}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleRefresh(d.id)}
                          disabled={isBusy}
                          className="text-neutral-400 hover:text-neutral-900 transition-colors disabled:opacity-50"
                          aria-label="Refresh status"
                        >
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleVerify(d.id)}
                          disabled={isBusy}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-200 bg-indigo-50 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                        >
                          Verify now
                        </button>
                        <button
                          onClick={() => handleRemove(d.id)}
                          disabled={isBusy}
                          className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                          aria-label="Remove domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expanded === d.id && (
                  <div className="border-t border-neutral-100 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-neutral-50">
                        <tr className="text-left text-neutral-500 uppercase tracking-wide font-bold">
                          <th className="px-4 py-2 font-bold">Record</th>
                          <th className="px-4 py-2 font-bold">Type</th>
                          <th className="px-4 py-2 font-bold">Name</th>
                          <th className="px-4 py-2 font-bold">Value</th>
                          <th className="px-4 py-2 font-bold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {d.records.map((r, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-neutral-900 font-medium">{r.record}</td>
                            <td className="px-4 py-2 text-neutral-500">{r.type}</td>
                            <td className="px-4 py-2 text-neutral-500 font-mono break-all">{r.name}</td>
                            <td className="px-4 py-2 text-neutral-500 font-mono break-all max-w-xs">{r.value}</td>
                            <td className="px-4 py-2">
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 font-medium",
                                  STATUS_STYLES[r.status] ?? STATUS_STYLES.not_started
                                )}
                              >
                                {r.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && <AddDomainModal onClose={() => setModalOpen(false)} />}
    </div>
  );
}
