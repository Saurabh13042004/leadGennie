"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowCircleUp, ArrowsClockwise, Check, EnvelopeSimple, Pause, PaperPlaneTilt, Play, Plugs, Trash, X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { pauseMailbox, removeMailbox, requestLimitIncrease, resumeMailbox, testMailbox } from "@/lib/actions/mailboxes";
import { decideApproval } from "@/lib/actions/approvals";
import { slugFor } from "@/lib/domain/mailboxes/oauth/slug";
import { isOAuthProvider, PROVIDER_LABEL, type Mailbox } from "@/lib/domain/mailboxes/types";
import Badge from "@/components/ui/Badge";
import Button, { buttonClasses } from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { inputClasses } from "@/components/ui/Field";
import { Callout, IconButton, TD, TH, THEAD_ROW } from "@/components/settings/bits";
import DisconnectModal from "./DisconnectModal";
import { mailboxStatusMeta, PROVIDER_MARK } from "./status";

function Capacity({ sent, limit }: { sent: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (sent / limit) * 100) : 0;
  return (
    <div className="w-28">
      <p className="whitespace-nowrap text-xs tabular-nums text-neutral-700">
        {sent}<span className="text-neutral-400"> / {limit} today</span>
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-amber-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-0.5 text-[11px] tabular-nums text-neutral-400">{Math.max(0, limit - sent)} left</p>
    </div>
  );
}

export default function MailboxesPanel({ mailboxes, canManage, canTest, canApprove }: { mailboxes: Mailbox[]; canManage: boolean; canTest: boolean; canApprove: boolean }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [raiseLimitId, setRaiseLimitId] = useState<number | null>(null);
  const [newLimit, setNewLimit] = useState(100);
  const [disconnecting, setDisconnecting] = useState<Mailbox | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  /** Runs an action that returns the `{ ok, data | error }` envelope (or throws, for the approval-gated ones) and reports the result. */
  function run(id: number, fn: () => Promise<unknown>, success?: (data: unknown) => string) {
    setBusyId(id);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = (await fn()) as { ok?: boolean; data?: unknown; error?: { message: string } } | undefined;
        if (res && res.ok === false) setNotice({ tone: "error", text: res.error?.message ?? "Action failed" });
        else if (success) setNotice({ tone: "success", text: success(res && "data" in res ? res.data : undefined) });
        router.refresh();
      } catch (e) {
        setNotice({ tone: "error", text: e instanceof Error ? e.message : "Action failed" });
      } finally {
        setBusyId(null);
      }
    });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader title="Connected mailboxes" description="Each mailbox sends up to its daily limit. Raising a limit needs owner/admin approval." />
      {notice && <Callout tone={notice.tone} role="status" className="mx-4 mt-3">{notice.text}</Callout>}

      {mailboxes.length === 0 ? (
        <EmptyState compact icon={EnvelopeSimple} title="No mailboxes yet" description="Connect the Google or Microsoft mailbox you already use for work — no DNS setup needed." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Mailbox</th>
                <th className={TH}>Status</th>
                <th className={TH}>Capacity</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {mailboxes.map((m) => {
                const isBusy = busyId === m.id && isPending;
                const s = mailboxStatusMeta(m.status, m.provider);
                const mark = PROVIDER_MARK[m.provider];
                const oauth = isOAuthProvider(m.provider);
                const needsReconnect = oauth && (m.status === "reconnect_required" || m.status === "disconnected");
                const canSend = m.status === "active" || m.status === "error";
                return (
                  <MailboxRows key={m.id} problem={needsReconnect ? m.blockedReason : m.status === "error" ? m.lastError : null}
                    reconnect={needsReconnect && canManage && isOAuthProvider(m.provider) ? <a href={`/api/mailboxes/${slugFor(m.provider)}/connect?mailboxId=${m.id}`} className={buttonClasses({ variant: "primary", size: "xs" })}><ArrowsClockwise className="h-3.5 w-3.5" weight="bold" /> Reconnect</a> : null}>
                    <td className={TD}>
                      <div className="flex min-w-0 max-w-[15rem] items-center gap-2.5">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] font-bold ring-1 ring-inset", mark.cls)}>{mark.letter}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{m.email}</p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                            {PROVIDER_LABEL[m.provider]}
                            {m.provider === "resend" && m.domainName && <span>· {m.domainName}</span>}
                            {m.provider === "resend" && m.domainStatus !== "verified" && <span className="text-amber-600">· domain not verified</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={TD}><Badge tone={s.tone} dot>{s.label}</Badge></td>
                    <td className={TD}>{canSend || m.status === "paused" ? <Capacity sent={m.sentToday} limit={m.dailyLimit} /> : <span className="text-xs text-neutral-400">—</span>}</td>
                    <td className={TD}>
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {m.status === "pending_approval" && canApprove && m.approvalId && (
                          <>
                            <Button size="xs" variant="primary" onClick={() => run(m.id, () => decideApproval(m.approvalId!, "approved"))} disabled={isBusy}><Check className="h-3.5 w-3.5" weight="bold" /> Approve</Button>
                            <Button size="xs" variant="danger" onClick={() => run(m.id, () => decideApproval(m.approvalId!, "rejected"))} disabled={isBusy}><X className="h-3.5 w-3.5" weight="bold" /> Reject</Button>
                          </>
                        )}
                        {m.status === "active" && canManage && raiseLimitId === m.id && (
                          <div className="flex items-center gap-1">
                            <input type="number" autoFocus aria-label="New daily limit" value={newLimit} onChange={(e) => setNewLimit(Number(e.target.value))} className={cn(inputClasses, "h-7 w-20 text-xs tabular-nums")} />
                            <Button size="xs" variant="accent" onClick={() => { run(m.id, () => requestLimitIncrease(m.id, newLimit), () => "Limit increase sent for approval."); setRaiseLimitId(null); }}>Request</Button>
                            <IconButton icon={X} label="Cancel" onClick={() => setRaiseLimitId(null)} />
                          </div>
                        )}
                        <div className="flex items-center gap-0.5">
                          {canSend && canTest && <IconButton icon={PaperPlaneTilt} label="Send a test email to me" busy={isBusy} disabled={isBusy} onClick={() => run(m.id, () => testMailbox(m.id), (d) => `Test email sent to ${(d as { to: string }).to}. Check your inbox.`)} />}
                          {m.status === "active" && canManage && raiseLimitId !== m.id && <IconButton icon={ArrowCircleUp} label="Raise limit" onClick={() => { setNewLimit(m.dailyLimit + 50); setRaiseLimitId(m.id); }} />}
                          {m.status === "active" && canManage && <IconButton icon={Pause} label="Pause" disabled={isBusy} onClick={() => run(m.id, () => pauseMailbox(m.id))} />}
                          {m.status === "paused" && canManage && <IconButton icon={Play} label="Resume" disabled={isBusy} onClick={() => run(m.id, () => resumeMailbox(m.id))} />}
                          {oauth && canManage && m.status !== "disconnected" && <IconButton icon={Plugs} label="Disconnect" tone="danger" disabled={isBusy} onClick={() => setDisconnecting(m)} />}
                          {!oauth && canManage && m.status !== "pending_approval" && <IconButton icon={Trash} label="Remove" tone="danger" disabled={isBusy} onClick={() => run(m.id, () => removeMailbox(m.id))} />}
                        </div>
                      </div>
                    </td>
                  </MailboxRows>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {disconnecting && (
        <DisconnectModal mailbox={disconnecting} onClose={() => setDisconnecting(null)}
          onDone={(text) => { setDisconnecting(null); setNotice({ tone: "success", text }); router.refresh(); }} />
      )}
    </Card>
  );
}

/** One mailbox: its row, plus (when something needs the user's attention) a full-width line under it with the fix. */
function MailboxRows({ children, problem, reconnect }: { children: React.ReactNode; problem: string | null; reconnect: React.ReactNode }) {
  return (
    <>
      <tr className="group transition-colors hover:bg-neutral-50/70">{children}</tr>
      {problem && (
        <tr className="bg-rose-50/40">
          <td colSpan={4} className="px-4 py-2.5 md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-700">
              <span>{problem}</span>
              {reconnect}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
