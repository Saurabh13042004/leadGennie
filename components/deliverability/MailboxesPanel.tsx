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
  active: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  pending_approval: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  paused: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
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
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Total</p>
          <p className="text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums mt-1">{mailboxes.length}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Active</p>
          <p className="text-2xl font-extrabold tracking-tight text-emerald-600 tabular-nums mt-1">{totalActive}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Pending approval</p>
          <p className="text-2xl font-extrabold tracking-tight text-indigo-600 tabular-nums mt-1">{totalPending}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-neutral-400">Sent today</p>
          <p className="text-2xl font-extrabold tracking-tight text-neutral-900 tabular-nums mt-1">
            {sentToday}/{dailyCapacity}
          </p>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        {canAdd && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add mailbox
          </button>
        )}
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {mailboxes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-neutral-900 font-semibold">No mailboxes yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Add a mailbox on a verified domain — it needs owner/admin approval before it can send.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50">
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
                  <th className="px-4 py-3">Mailbox</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Daily sends</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {mailboxes.map((m) => {
                  const isBusy = busyId === m.id && isPending;
                  return (
                    <tr key={m.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3 text-neutral-900 font-medium">{m.email}</td>
                      <td className="px-4 py-3 text-neutral-500">
                        {m.domainName}
                        {m.domainStatus !== "verified" && (
                          <span className="ml-1.5 text-[11px] text-amber-600">(domain not verified)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-medium rounded-full px-2.5 py-1", STATUS_STYLES[m.status])}>
                          {m.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-neutral-700 tabular-nums">
                        {m.sentToday}/{m.dailyLimit}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          {m.status === "pending_approval" && canApprove && m.approvalId && (
                            <>
                              <button
                                onClick={() => run(m.id, () => decideApproval(m.approvalId!, "approved"))}
                                disabled={isBusy}
                                className="flex items-center gap-1 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Approve
                              </button>
                              <button
                                onClick={() => run(m.id, () => decideApproval(m.approvalId!, "rejected"))}
                                disabled={isBusy}
                                className="flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
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
                                    className="w-16 bg-neutral-50 border border-neutral-200 rounded-lg text-xs text-neutral-900 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                                  />
                                  <button
                                    onClick={() => handleRaiseLimit(m.id)}
                                    className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
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
                                  className="text-neutral-400 hover:text-indigo-600 transition-colors"
                                  aria-label="Raise limit"
                                >
                                  <ArrowUpCircle className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => run(m.id, () => pauseMailbox(m.id))}
                                disabled={isBusy}
                                className="text-neutral-400 hover:text-amber-600 transition-colors disabled:opacity-50"
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
                              className="text-neutral-400 hover:text-emerald-600 transition-colors disabled:opacity-50"
                              aria-label="Resume"
                            >
                              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            </button>
                          )}
                          {canManage && m.status !== "pending_approval" && (
                            <button
                              onClick={() => run(m.id, () => removeMailbox(m.id))}
                              disabled={isBusy}
                              className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
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
