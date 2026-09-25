"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowCircleUp, Check, EnvelopeSimple, Pause, Play, Plus, Trash, X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { pauseMailbox, resumeMailbox, removeMailbox, requestLimitIncrease, type Mailbox } from "@/lib/actions/mailboxes";
import { decideApproval } from "@/lib/actions/approvals";
import type { Domain } from "@/lib/actions/domains";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { inputClasses } from "@/components/ui/Field";
import { Callout, IconButton, TD, TH, THEAD_ROW } from "@/components/settings/bits";
import AddMailboxModal from "./AddMailboxModal";
import { statusMeta } from "./status";

function SendMeter({ sent, limit }: { sent: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (sent / limit) * 100) : 0;
  return (
    <div className="w-28">
      <p className="text-xs tabular-nums text-neutral-700">
        {sent}
        <span className="text-neutral-400"> / {limit}</span>
      </p>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-neutral-100">
        <div className={cn("h-full rounded-full", pct >= 90 ? "bg-amber-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

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
    <Card className="overflow-hidden">
      <CardHeader
        title="Mailboxes"
        description="Each mailbox sends up to its daily limit. New mailboxes and limit increases need owner/admin approval."
        action={
          canAdd && (
            <Button size="xs" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" weight="bold" />
              Add mailbox
            </Button>
          )
        }
      />

      {error && <Callout className="mx-4 mt-3">{error}</Callout>}

      {mailboxes.length === 0 ? (
        <EmptyState
          compact
          icon={EnvelopeSimple}
          title="No mailboxes yet"
          description="Add a mailbox on a verified domain — it needs owner/admin approval before it can send."
          actions={
            canAdd && (
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" weight="bold" /> Add mailbox
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Mailbox</th>
                <th className={TH}>Status</th>
                <th className={TH}>Sent today</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {mailboxes.map((m) => {
                const isBusy = busyId === m.id && isPending;
                const s = statusMeta(m.status);
                return (
                  <tr key={m.id} className="group transition-colors hover:bg-neutral-50/70">
                    <td className={TD}>
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                          <EnvelopeSimple className="h-3.5 w-3.5" weight="duotone" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-neutral-900">{m.email}</p>
                          <p className="flex items-center gap-1.5 truncate text-xs text-neutral-500">
                            {m.domainName}
                            {m.domainStatus !== "verified" && <span className="text-amber-600">· domain not verified</span>}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={TD}><Badge tone={s.tone} dot>{s.label}</Badge></td>
                    <td className={TD}><SendMeter sent={m.sentToday} limit={m.dailyLimit} /></td>
                    <td className={TD}>
                      <div className="flex items-center justify-end gap-1">
                        {m.status === "pending_approval" && canApprove && m.approvalId && (
                          <>
                            <Button size="xs" variant="primary" onClick={() => run(m.id, () => decideApproval(m.approvalId!, "approved"))} disabled={isBusy}>
                              <Check className="h-3.5 w-3.5" weight="bold" />
                              Approve
                            </Button>
                            <Button size="xs" variant="danger" onClick={() => run(m.id, () => decideApproval(m.approvalId!, "rejected"))} disabled={isBusy}>
                              <X className="h-3.5 w-3.5" weight="bold" />
                              Reject
                            </Button>
                          </>
                        )}
                        {m.status === "active" && canManage && raiseLimitId === m.id && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              autoFocus
                              aria-label="New daily limit"
                              value={newLimit}
                              onChange={(e) => setNewLimit(Number(e.target.value))}
                              className={cn(inputClasses, "h-7 w-20 text-xs tabular-nums")}
                            />
                            <Button size="xs" variant="accent" onClick={() => handleRaiseLimit(m.id)}>
                              Request
                            </Button>
                            <IconButton icon={X} label="Cancel" onClick={() => setRaiseLimitId(null)} />
                          </div>
                        )}
                        <div className="flex items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                          {m.status === "active" && canManage && raiseLimitId !== m.id && (
                            <IconButton
                              icon={ArrowCircleUp}
                              label="Raise limit"
                              onClick={() => {
                                setNewLimit(m.dailyLimit + 50);
                                setRaiseLimitId(m.id);
                              }}
                            />
                          )}
                          {m.status === "active" && canManage && (
                            <IconButton icon={Pause} label="Pause" busy={isBusy} disabled={isBusy} onClick={() => run(m.id, () => pauseMailbox(m.id))} />
                          )}
                          {m.status === "paused" && canManage && (
                            <IconButton icon={Play} label="Resume" busy={isBusy} disabled={isBusy} onClick={() => run(m.id, () => resumeMailbox(m.id))} />
                          )}
                          {canManage && m.status !== "pending_approval" && (
                            <IconButton icon={Trash} label="Remove" tone="danger" disabled={isBusy} onClick={() => run(m.id, () => removeMailbox(m.id))} />
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <AddMailboxModal domains={domains} onClose={() => setModalOpen(false)} />}
    </Card>
  );
}
