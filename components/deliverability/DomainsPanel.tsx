"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, CaretRight, Globe, Plus, SealCheck, ShieldCheck, Trash } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { refreshDomain, triggerVerify, removeDomain, type Domain } from "@/lib/actions/domains";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge, { TONE } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { Callout, IconButton, TD, TH, THEAD_ROW, timeAgo } from "@/components/settings/bits";
import AddDomainModal from "./AddDomainModal";
import DnsRecordsTable from "./DnsRecordsTable";
import { statusMeta, worstTone } from "./status";

/** SPF / DKIM / DMARC chips: one per record group, coloured by its worst record status. */
function RecordChips({ domain }: { domain: Domain }) {
  const groups = new Map<string, string[]>();
  for (const r of domain.records) groups.set(r.record, [...(groups.get(r.record) ?? []), r.status]);
  if (groups.size === 0) return <span className="text-xs text-neutral-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {[...groups].map(([name, statuses]) => {
        const tone = worstTone(statuses);
        return (
          <span key={name} className="inline-flex h-5 items-center gap-1 rounded-md bg-white px-1.5 text-[11px] font-medium text-neutral-600 ring-1 ring-inset ring-neutral-200">
            <span className={cn("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />
            {name}
          </span>
        );
      })}
    </div>
  );
}

export default function DomainsPanel({ domains, canAdd, canManage }: { domains: Domain[]; canAdd: boolean; canManage: boolean }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(id: number, fn: () => Promise<unknown>, fallback: string) {
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : fallback);
      } finally {
        setBusyId(null);
      }
    });
  }

  const handleRefresh = (id: number) => run(id, () => refreshDomain(id), "Could not refresh");
  const handleVerify = (id: number) => run(id, () => triggerVerify(id), "Could not trigger verification");
  const handleRemove = (id: number) => run(id, () => removeDomain(id), "Could not remove domain");

  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Sending domains"
        description="No email sends until its domain passes SPF and DKIM verification."
        action={
          canAdd && (
            <Button size="xs" onClick={() => setModalOpen(true)}>
              <Plus className="h-3.5 w-3.5" weight="bold" />
              Add domain
            </Button>
          )
        }
      />

      {error && <Callout className="mx-4 mt-3">{error}</Callout>}

      {domains.length === 0 ? (
        <EmptyState
          compact
          icon={ShieldCheck}
          title="No sending domains yet"
          description="Add a domain to get real SPF/DKIM/DMARC records from Resend — no email can send until its domain is verified."
          actions={
            canAdd && (
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                <Plus className="h-4 w-4" weight="bold" /> Add domain
              </Button>
            )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className={THEAD_ROW}>
                <th className={TH}>Domain</th>
                <th className={TH}>Status</th>
                <th className={cn(TH, "hidden sm:table-cell")}>DNS records</th>
                <th className={cn(TH, "hidden md:table-cell")}>Last checked</th>
                <th className={TH}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {domains.map((d) => {
                const isBusy = busyId === d.id && isPending;
                const open = expanded === d.id;
                const s = statusMeta(d.status);
                return (
                  <Fragment key={d.id}>
                    <tr className={cn("group transition-colors hover:bg-neutral-50/70", open && "bg-neutral-50/70")}>
                      <td className={TD}>
                        <button
                          type="button"
                          onClick={() => setExpanded(open ? null : d.id)}
                          aria-expanded={open}
                          className="flex min-w-0 items-center gap-2 text-left"
                        >
                          <CaretRight className={cn("h-3 w-3 shrink-0 text-neutral-400 transition-transform", open && "rotate-90")} weight="bold" />
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-neutral-100 text-neutral-500">
                            {d.status === "verified" ? <SealCheck className="h-3.5 w-3.5 text-emerald-600" weight="fill" /> : <Globe className="h-3.5 w-3.5" weight="duotone" />}
                          </span>
                          <span className="truncate font-medium text-neutral-900">{d.name}</span>
                        </button>
                      </td>
                      <td className={TD}><Badge tone={s.tone} dot pulse={d.status === "pending"}>{s.label}</Badge></td>
                      <td className={cn(TD, "hidden sm:table-cell")}><RecordChips domain={d} /></td>
                      <td className={cn(TD, "hidden text-xs text-neutral-500 md:table-cell")}>
                        {d.lastCheckedAt ? <span suppressHydrationWarning>{timeAgo(d.lastCheckedAt)}</span> : "—"}
                      </td>
                      <td className={TD}>
                        {canManage && (
                          <div className="flex items-center justify-end gap-1">
                            {d.status !== "verified" && (
                              <Button size="xs" onClick={() => handleVerify(d.id)} disabled={isBusy} aria-label="Verify now">
                                <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" weight="duotone" />
                                <span className="hidden sm:inline">Verify now</span>
                              </Button>
                            )}
                            <div className="flex items-center gap-0.5 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                              <IconButton icon={ArrowsClockwise} label="Refresh status" busy={isBusy} disabled={isBusy} onClick={() => handleRefresh(d.id)} />
                              {d.status === "verified" && (
                                <IconButton icon={ShieldCheck} label="Verify now" disabled={isBusy} onClick={() => handleVerify(d.id)} />
                              )}
                              <IconButton icon={Trash} label="Remove domain" tone="danger" disabled={isBusy} onClick={() => handleRemove(d.id)} />
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-neutral-50/70">
                        <td colSpan={5} className="border-t border-neutral-100 p-0">
                          <DnsRecordsTable records={d.records} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && <AddDomainModal onClose={() => setModalOpen(false)} />}
    </Card>
  );
}
