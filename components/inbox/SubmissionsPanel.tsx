"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2, UserPlus, Ban, EyeOff, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createLeadFromSubmission,
  linkSubmissionToLead,
  markSubmissionSpam,
  applyDncFromSubmission,
  assignSubmission,
  ignoreSubmission,
  type Submission,
} from "@/lib/actions/forms";
import { decideApproval } from "@/lib/actions/approvals";
import type { Lead } from "@/lib/actions/leads";
import type { Member } from "@/lib/actions/workspace";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-300 border-yellow-500/20",
  proposed: "bg-purple-500/10 text-purple-300 border-purple-500/20",
  resolved: "bg-green-500/10 text-green-300 border-green-500/20",
  spam: "bg-red-500/10 text-red-300 border-red-500/20",
  duplicate: "bg-white/5 text-neutral-400 border-white/10",
  dnc_blocked: "bg-orange-500/10 text-orange-300 border-orange-500/20",
  ignored: "bg-white/5 text-neutral-500 border-white/10",
};

export default function SubmissionsPanel({
  submissions,
  leads,
  members,
  canManage,
  canApprove,
}: {
  submissions: Submission[];
  leads: Lead[];
  members: Member[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  if (submissions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
        <p className="text-white font-medium">Nothing here</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          Form submissions will show up here as they come in, whether or not they auto-matched to an existing lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400">{error}</p>}
      {submissions.map((s) => {
        const isBusy = busyId === s.id && isPending;
        const isActionable = ["pending", "dnc_blocked"].includes(s.status);
        return (
          <div key={s.id} className="rounded-xl border border-white/10 bg-[#0A0A0A] p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm text-white">
                  {s.payload.full_name || s.payload.email || "Unknown submitter"}
                </p>
                <p className="text-xs text-neutral-500">
                  {s.payload.email}
                  {s.payload.company ? ` · ${s.payload.company}` : ""} · via {s.formName}
                </p>
              </div>
              <span className={cn("text-xs border rounded-full px-2.5 py-1", STATUS_STYLES[s.status] ?? STATUS_STYLES.pending)}>
                {s.status.replace(/_/g, " ")}
              </span>
            </div>

            <div className="flex flex-wrap gap-3 mt-2 text-xs text-neutral-500">
              {s.consentGiven ? (
                <span>Consent v{s.consentVersion} given</span>
              ) : (
                <span className="text-yellow-400/80">No consent recorded</span>
              )}
              {s.utmSource && <span>utm_source={s.utmSource}</span>}
              {s.matchedLeadName && <span className="text-blue-300">Matched: {s.matchedLeadName}</span>}
              {s.ownerName && <span>Assigned: {s.ownerName}</span>}
            </div>

            {s.approvalId && canApprove && (
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => run(s.id, () => decideApproval(s.approvalId!, "approved"))}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs text-black bg-white hover:bg-neutral-200 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
                >
                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Review proposal
                </button>
                <button
                  onClick={() => run(s.id, () => decideApproval(s.approvalId!, "rejected"))}
                  disabled={isBusy}
                  className="text-xs text-red-300 hover:text-red-200 transition-colors disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}

            {isActionable && canManage && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-white/5">
                {linkingId === s.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) run(s.id, () => linkSubmissionToLead(s.id, Number(e.target.value)));
                        setLinkingId(null);
                      }}
                      className="bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none"
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Pick a lead…
                      </option>
                      {leads.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <button
                    onClick={() => setLinkingId(s.id)}
                    className="flex items-center gap-1.5 text-xs text-blue-300 hover:text-blue-200 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link to record
                  </button>
                )}
                <button
                  onClick={() => run(s.id, () => createLeadFromSubmission(s.id))}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors disabled:opacity-50"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Create record
                </button>
                <button
                  onClick={() => run(s.id, () => markSubmissionSpam(s.id))}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  Mark spam
                </button>
                <button
                  onClick={() => run(s.id, () => applyDncFromSubmission(s.id))}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-orange-400 transition-colors disabled:opacity-50"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Apply DNC
                </button>
                {assigningId === s.id ? (
                  <select
                    onChange={(e) => {
                      if (e.target.value) run(s.id, () => assignSubmission(s.id, Number(e.target.value)));
                      setAssigningId(null);
                    }}
                    className="bg-white/5 border border-white/10 rounded-lg text-xs text-white px-2 py-1.5 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Assign to…
                    </option>
                    {members
                      .filter((m) => m.userId)
                      .map((m) => (
                        <option key={m.userId} value={m.userId!}>
                          {m.name ?? m.email}
                        </option>
                      ))}
                  </select>
                ) : (
                  <button
                    onClick={() => setAssigningId(s.id)}
                    className="flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Assign
                  </button>
                )}
                <button
                  onClick={() => run(s.id, () => ignoreSubmission(s.id))}
                  disabled={isBusy}
                  className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  Ignore
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
