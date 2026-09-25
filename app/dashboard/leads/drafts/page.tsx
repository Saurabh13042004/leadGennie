import Link from "next/link";
import { CaretRight, EnvelopeSimpleOpen, Warning, WarningOctagon } from "@phosphor-icons/react/ssr";
import { getDraftQueue } from "@/lib/actions/personalization";
import LeadsPageHeader from "@/components/leads/LeadsPageHeader";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import { STATUS_STYLE } from "@/components/leads/draft/status-style";
import type { DraftStatus } from "@/lib/domain/personalization/types";

export const metadata = {
  title: "Email drafts | LeadGennie",
};

const FILTERS: { key: string; label: string; statuses: DraftStatus[] }[] = [
  { key: "needs_review", label: "Needs review", statuses: ["draft", "edited"] },
  { key: "failed_validation", label: "Failed checks", statuses: ["failed_validation"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
  { key: "all", label: "All", statuses: ["draft", "edited", "approved", "rejected", "failed_validation"] },
];

export default async function DraftsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const active = FILTERS.find((f) => f.key === status) ?? FILTERS[0];
  const { items, counts } = await getDraftQueue(active.key === "all" ? undefined : active.key);

  return (
    <>
      <LeadsPageHeader description="Every personal detail is tied to a verified source" />

      <div className="flex flex-wrap items-center gap-1 border-b border-neutral-200/80 px-4 py-2.5 md:px-6" role="tablist" aria-label="Draft status">
        {FILTERS.map((f) => {
          const n = f.statuses.reduce((sum, s) => sum + counts[s], 0);
          const on = f.key === active.key;
          return (
            <Link
              key={f.key}
              href={`/dashboard/leads/drafts?status=${f.key}`}
              role="tab"
              aria-selected={on}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors",
                on ? "bg-neutral-900 text-white" : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
              )}
            >
              {f.label}
              <span className={cn("rounded px-1 text-[11px] tabular-nums", on ? "bg-white/20" : "bg-neutral-100 text-neutral-500")}>{n}</span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={EnvelopeSimpleOpen}
          title="Nothing here"
          description="Select leads on the All leads tab and choose “Generate emails”, or open a single lead to write one."
          actions={
            <Link href="/dashboard/leads" className="text-[13px] font-medium text-indigo-600 hover:text-indigo-800">
              Go to All leads →
            </Link>
          }
        />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {items.map((d) => {
            const s = STATUS_STYLE[d.status];
            return (
              <li key={d.id}>
                <Link href={`/dashboard/leads/${d.leadId}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-neutral-50/80 md:px-6">
                  <Avatar name={d.leadName} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-neutral-900">
                      {d.leadName}
                      {d.company && <span className="font-normal text-neutral-400"> · {d.company}</span>}
                    </span>
                    <span className="block truncate text-[13px] text-neutral-500">{d.subject || "(no subject)"}</span>
                  </span>
                  {d.errorCount > 0 && (
                    <span className="hidden items-center gap-1 text-xs font-medium text-rose-600 sm:inline-flex">
                      <WarningOctagon className="h-3.5 w-3.5" weight="fill" />
                      {d.errorCount} problem{d.errorCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {d.warningCount > 0 && (
                    <span className="hidden items-center gap-1 text-xs font-medium text-amber-600 sm:inline-flex">
                      <Warning className="h-3.5 w-3.5" weight="fill" />
                      {d.warningCount} warning{d.warningCount === 1 ? "" : "s"}
                    </span>
                  )}
                  <span className={`inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-medium ${s.cls}`}>{s.label}</span>
                  <span className="hidden w-20 text-right text-xs tabular-nums text-neutral-400 sm:block">{new Date(d.updatedAt).toLocaleDateString()}</span>
                  <CaretRight className="h-3.5 w-3.5 text-neutral-300 transition-transform group-hover:translate-x-0.5 group-hover:text-neutral-500" weight="bold" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
