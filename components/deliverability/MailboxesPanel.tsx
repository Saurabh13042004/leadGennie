"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pause, Play, Trash2, ArrowUpCircle, Check, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  pauseMailbox,
  resumeMailbox,
  removeMailbox,
  requestLimitIncrease,
  type Mailbox,
} from "@/lib/actions/mailboxes";
import { decideApproval } from "@/lib/actions/approvals";
import type { Domain } from "@/lib/actions/domains";
import AddMailboxModal from "./AddMailboxModal";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-500/10 text-green-300 border-green-500/20",
  pending_approval: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  paused: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
};

export default function MailboxesPanel({
  mailboxes,
  domains,
  canAdd,
  canManage,
  canApprove,
}: {
  mailboxes: Mailbox[];
  domains: Domain[];
  canAdd: boolean;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [raiseLimitId, setRaiseLimitId] = useState<number | null>(null);
  const [newLimit, setNewLimit] = useState(100);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const totalActive = mailboxes.filter((m) => m.status === "active").length;
  const totalPending = mailboxes.filter((m) => m.status === "pending_approval").length;
  const dailyCapacity = mailboxes.filter((m) => m.status === "active").reduce((acc, m) => acc + m.dailyLimit, 0);
  const sentToday = mailboxes.reduce((acc, m) => acc + m.sentToday, 0);

  function run(id: number, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      } finally {
        setBusyId(null);
      }
    });
  }

  function handleRaiseLimit(mailboxId: number) {
    run(mailboxId, () => requestLimitIncrease(mailboxId, newLimit));
    setRaiseLimitId(null);
  }

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-white tabular-nums">{mailboxes.length}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Total</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-green-400 tabular-nums">{totalActive}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Active</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-purple-300 tabular-nums">{totalPending}</p>
          <p className="text-xs text-neutral-500 mt-0.5">Pending approval</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
          <p className="text-lg font-semibold text-white tabular-nums">
            {sentToday}/{dailyCapacity}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">Sent today (informational)</p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add mailbox
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

      {mailboxes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">No mailboxes yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Add a mailbox on a verified domain — it needs owner/admin approval before it can send.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
                  <th className="px-4 py-3 font-medium">Mailbox</th>
                  <th className="px-4 py-3 font-medium">Domain</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Daily sends</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {mailboxes.map((m) => {
                  const isBusy = busyId === m.id && isPending;
                  return (
                    <tr key={m.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-3 text-white">{m.email}</td>
                      <td className="px-4 py-3 text-neutral-400">
                        {m.domainName}
                        {m.domainStatus !== "verified" && (
                          <span className="ml-1.5 text-[11px] text-yellow-400/80">(domain not verified)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs border rounded-full px-2.5 py-1", STATUS_STYLES[m.status])}>
                          {m.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-300 tabular-nums">
                        {m.sentToday}/{m.dailyLimit}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {m.status === "pending_approval" && canApprove && m.approvalId && (
                            <>
                              <button
                                onClick={() => run(m.id, () => decideApproval(m.approvalId!, "approved"))}
                                disabled={isBusy}
                                className="flex items-center gap-1 text-xs text-black bg-white hover:bg-neutral-200 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => run(m.id, () => decideApproval(m.approvalId!, "rejected"))}
                                disabled={isBusy}
                                className="flex items-center gap-1 text-xs text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" />
                                Reject
                              </button>
                            </>
                          )}
                          {m.status === "active" && canManage && (
                            <>
                              {raiseLimitId === m.id ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    autoFocus
                                    value={newLimit}
                                    onChange={(e) => setNewLimit(Number(e.target.value))}
                                    className="w-16 bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1 focus:outline-none"
                                  />
                                  <button
                                    onClick={() => handleRaiseLimit(m.id)}
                                    className="text-xs text-blue-300 hover:text-blue-200"
                                  >
                                    Request
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setNewLimit(m.dailyLimit + 50);
                                    setRaiseLimitId(m.id);
                                  }}
                                  className="text-neutral-500 hover:text-blue-400 transition-colors"
                                  aria-label="Raise limit"
                                >
                                  <ArrowUpCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => run(m.id, () => pauseMailbox(m.id))}
                                disabled={isBusy}
                                className="text-neutral-500 hover:text-yellow-400 transition-colors disabled:opacity-50"
                                aria-label="Pause"
                              >
                                {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pause className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          {m.status === "paused" && canManage && (
                            <button
                              onClick={() => run(m.id, () => resumeMailbox(m.id))}
                              disabled={isBusy}
                              className="text-neutral-500 hover:text-green-400 transition-colors disabled:opacity-50"
                              aria-label="Resume"
                            >
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          {canManage && m.status !== "pending_approval" && (
                            <button
                              onClick={() => run(m.id, () => removeMailbox(m.id))}
                              disabled={isBusy}
                              className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                              aria-label="Remove"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && <AddMailboxModal domains={domains} onClose={() => setModalOpen(false)} />}
    </div>
  );
}
