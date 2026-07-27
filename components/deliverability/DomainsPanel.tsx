"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Plus, RefreshCw, ShieldCheck, Trash2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { refreshDomain, triggerVerify, removeDomain, type Domain } from "@/lib/actions/domains";
import AddDomainModal from "./AddDomainModal";

const STATUS_STYLES: Record<string, string> = {
  verified: "bg-green-500/10 text-green-300 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  not_started: "bg-white/5 text-neutral-400 border-white/10",
  failed: "bg-red-500/10 text-red-300 border-red-500/20",
  partially_verified: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  partially_failed: "bg-red-500/10 text-red-300 border-red-500/20",
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
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add domain
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {domains.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <ShieldCheck className="w-10 h-10 text-neutral-600 mb-3" />
          <p className="text-white font-medium">No sending domains yet</p>
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
              <div key={d.id} className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <button
                    onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                    className="flex items-center gap-2 min-w-0 text-left"
                  >
                    {expanded === d.id ? (
                      <ChevronDown className="w-4 h-4 text-neutral-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-500 shrink-0" />
                    )}
                    <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-sm text-white truncate">{d.name}</span>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn("text-xs border rounded-full px-2.5 py-1", STATUS_STYLES[d.status] ?? STATUS_STYLES.not_started)}>
                      {d.status.replace(/_/g, " ")}
                    </span>
                    {canManage && (
                      <>
                        <button
                          onClick={() => handleRefresh(d.id)}
                          disabled={isBusy}
                          className="text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                          aria-label="Refresh status"
                        >
                          {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleVerify(d.id)}
                          disabled={isBusy}
                          className="text-xs text-blue-300 hover:text-blue-200 border border-blue-500/30 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                        >
                          Verify now
                        </button>
                        <button
                          onClick={() => handleRemove(d.id)}
                          disabled={isBusy}
                          className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                          aria-label="Remove domain"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {expanded === d.id && (
                  <div className="border-t border-white/10 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-neutral-500 uppercase tracking-wider">
                          <th className="px-4 py-2 font-medium">Record</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Name</th>
                          <th className="px-4 py-2 font-medium">Value</th>
                          <th className="px-4 py-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.records.map((r, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-4 py-2 text-white">{r.record}</td>
                            <td className="px-4 py-2 text-neutral-400">{r.type}</td>
                            <td className="px-4 py-2 text-neutral-400 font-mono break-all">{r.name}</td>
                            <td className="px-4 py-2 text-neutral-400 font-mono break-all max-w-xs">{r.value}</td>
                            <td className="px-4 py-2">
                              <span className={cn("border rounded-full px-2 py-0.5", STATUS_STYLES[r.status] ?? STATUS_STYLES.not_started)}>
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
