import Link from "next/link";
import { UsersThree } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import type { CampaignLeadRow } from "@/lib/domain/campaigns/read-model";
import Card, { CardHeader } from "@/components/ui/Card";
import Avatar from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { formatWhen } from "../builder/ui";

const STATUS_TONE: Record<string, Tone> = {
  active: "emerald", pending: "neutral", completed: "sky", replied: "violet", blocked: "amber", stopped: "neutral", bounced: "rose", unsubscribed: "rose", failed: "rose",
};

/** Per-lead state: where each person is in the sequence, what's next, and why anyone stopped. */
export default function CampaignLeadsTable({ id, rows, counts, filter, steps }: { id: number; rows: CampaignLeadRow[]; counts: Record<string, number>; filter: string | null; steps: number }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const pills = [{ key: null as string | null, label: "All", n: total }, ...Object.keys(counts).map((s) => ({ key: s, label: s, n: counts[s] }))];
  return (
    <Card>
      <CardHeader title="Leads" description="Where each person is in the sequence." />
      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-100 px-4 py-2.5" role="tablist" aria-label="Lead status">
        {pills.map((p) => {
          const on = p.key === filter;
          return (
            <Link key={p.key ?? "all"} role="tab" aria-selected={on} href={p.key ? `/dashboard/campaigns/${id}?status=${p.key}` : `/dashboard/campaigns/${id}`}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium capitalize transition-colors", on ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900")}>
              {p.label}
              <span className={cn("rounded px-1 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-neutral-100 text-neutral-500")}>{p.n}</span>
            </Link>
          );
        })}
      </div>
      {rows.length === 0 ? (
        <EmptyState compact icon={UsersThree} title="No leads enrolled yet" description="Leads are enrolled when the campaign launches — excluded ones are listed too, with the reason." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-neutral-200/80 bg-neutral-50/60 text-left text-xs text-neutral-500">
                <th className="py-2 pl-4 pr-3 font-medium">Lead</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Sent</th>
                <th className="px-3 py-2 font-medium">Next email</th>
                <th className="py-2 pl-3 pr-4 font-medium">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={r.leadId} className="transition-colors hover:bg-neutral-50/80">
                  <td className="py-2.5 pl-4 pr-3">
                    <Link href={`/dashboard/leads/${r.leadId}`} className="flex items-center gap-2.5">
                      <Avatar name={r.name} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-neutral-900 hover:text-indigo-600">{r.name}</span>
                        <span className="block truncate text-xs text-neutral-400">{r.email ?? "no email"}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={STATUS_TONE[r.status] ?? "neutral"} dot className="capitalize">{r.status}</Badge></td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-neutral-700">{r.sent}/{steps}</td>
                  <td className="px-3 py-2.5 tabular-nums text-neutral-600">{formatWhen(r.nextActionAt)}</td>
                  <td className="py-2.5 pl-3 pr-4 text-xs text-neutral-500">{r.stopReason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
