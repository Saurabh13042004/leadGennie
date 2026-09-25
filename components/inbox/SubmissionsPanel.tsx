"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, CircleNotch, EyeSlash, LinkSimple, Prohibit, ShieldCheck, ShieldWarning, Tray, UserCirclePlus, UserPlus, Warning } from "@phosphor-icons/react/ssr";
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
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";

const STATUS_TONE: Record<string, Tone> = {
  pending: "amber",
  proposed: "indigo",
  resolved: "emerald",
  spam: "rose",
  duplicate: "neutral",
  dnc_blocked: "rose",
  ignored: "neutral",
};

const pickerCls =
  "h-7 rounded-md bg-white px-2 text-xs text-neutral-900 ring-1 ring-inset ring-neutral-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50";
const actionCls =
  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50";

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
      <EmptyState
        icon={Tray}
        title="Nothing here"
        description="Form submissions will show up here as they come in, whether or not they auto-matched to an existing lead."
      />
    );
  }

  return (
    <div>
      {error && <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200 md:mx-6">{error}</p>}
      <ul className="divide-y divide-neutral-100">
        {submissions.map((s) => {
          const isBusy = busyId === s.id && isPending;
          const isActionable = ["pending", "dnc_blocked"].includes(s.status);
          const who = s.payload.full_name || s.payload.email || "Unknown submitter";
          return (
            <li key={s.id} className="group px-4 py-3 transition-colors hover:bg-neutral-50/60 md:px-6">
              <div className="flex items-start gap-3">
                <Avatar name={who} size="md" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[13px] font-medium text-neutral-900">{who}</p>
                    <Badge tone={STATUS_TONE[s.status] ?? "amber"} dot className="capitalize">{s.status.replace(/_/g, " ")}</Badge>
                    <span className="ml-auto whitespace-nowrap text-xs tabular-nums text-neutral-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    {s.payload.email}
                    {s.payload.company ? ` · ${s.payload.company}` : ""} · via {s.formName}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {s.consentGiven ? (
                      <span className="inline-flex items-center gap-1 text-neutral-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" weight="fill" />
                        Consent v{s.consentVersion} given
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700">
                        <ShieldWarning className="h-3.5 w-3.5" weight="fill" />
                        No consent recorded
                      </span>
                    )}
                    {s.utmSource && <Badge tone="neutral" className="font-mono text-[10px]">utm_source={s.utmSource}</Badge>}
                    {s.matchedLeadName && <Badge tone="indigo">Matched: {s.matchedLeadName}</Badge>}
                    {s.ownerName && <Badge tone="violet">Assigned: {s.ownerName}</Badge>}
                  </div>

                  {s.approvalId && canApprove && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <Button variant="primary" size="xs" onClick={() => run(s.id, () => decideApproval(s.approvalId!, "approved"))} disabled={isBusy}>
                        {isBusy ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <CheckCircle className="h-3.5 w-3.5" weight="fill" />}
                        Review proposal
                      </Button>
                      <Button variant="ghost" size="xs" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={() => run(s.id, () => decideApproval(s.approvalId!, "rejected"))} disabled={isBusy}>
                        Reject
                      </Button>
                    </div>
                  )}

                  {isActionable && canManage && (
                    <div className="-ml-2 mt-2 flex flex-wrap items-center gap-0.5">
                      {linkingId === s.id ? (
                        <select
                          autoFocus
                          onChange={(e) => {
                            if (e.target.value) run(s.id, () => linkSubmissionToLead(s.id, Number(e.target.value)));
                            setLinkingId(null);
                          }}
                          className={cn(pickerCls, "ml-2 mr-1")}
                          defaultValue=""
                        >
                          <option value="" disabled>Pick a lead…</option>
                          {leads.map((l) => (
                            <option key={l.id} value={l.id}>{l.full_name}</option>
                          ))}
                        </select>
                      ) : (
                        <button onClick={() => setLinkingId(s.id)} className={cn(actionCls, "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700")}>
                          <LinkSimple className="h-3.5 w-3.5" weight="bold" />
                          Link to record
                        </button>
                      )}
                      <button onClick={() => run(s.id, () => createLeadFromSubmission(s.id))} disabled={isBusy} className={actionCls}>
                        <UserPlus className="h-3.5 w-3.5" weight="bold" />
                        Create record
                      </button>
                      <button onClick={() => run(s.id, () => markSubmissionSpam(s.id))} disabled={isBusy} className={cn(actionCls, "hover:bg-rose-50 hover:text-rose-600")}>
                        <Warning className="h-3.5 w-3.5" weight="bold" />
                        Mark spam
                      </button>
                      <button onClick={() => run(s.id, () => applyDncFromSubmission(s.id))} disabled={isBusy} className={cn(actionCls, "hover:bg-amber-50 hover:text-amber-700")}>
                        <Prohibit className="h-3.5 w-3.5" weight="bold" />
                        Apply DNC
                      </button>
                      {assigningId === s.id ? (
                        <select
                          autoFocus
                          onChange={(e) => {
                            if (e.target.value) run(s.id, () => assignSubmission(s.id, Number(e.target.value)));
                            setAssigningId(null);
                          }}
                          className={cn(pickerCls, "mx-1")}
                          defaultValue=""
                        >
                          <option value="" disabled>Assign to…</option>
                          {members
                            .filter((m) => m.userId)
                            .map((m) => (
                              <option key={m.userId} value={m.userId!}>{m.name ?? m.email}</option>
                            ))}
                        </select>
                      ) : (
                        <button onClick={() => setAssigningId(s.id)} className={actionCls}>
                          <UserCirclePlus className="h-3.5 w-3.5" weight="bold" />
                          Assign
                        </button>
                      )}
                      <button onClick={() => run(s.id, () => ignoreSubmission(s.id))} disabled={isBusy} className={cn(actionCls, "text-neutral-500")}>
                        <EyeSlash className="h-3.5 w-3.5" weight="bold" />
                        Ignore
                      </button>
                      {isBusy && <CircleNotch className="ml-1 h-3.5 w-3.5 animate-spin text-neutral-400" weight="bold" />}
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
