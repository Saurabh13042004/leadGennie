import Link from "next/link";
import { Mail } from "lucide-react";
import { getDraftQueue } from "@/lib/actions/personalization";
import LeadsSubNav from "@/components/leads/LeadsSubNav";
import { STATUS_STYLE } from "@/components/leads/draft/DraftPanel";
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
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <LeadsSubNav />
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Mail className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-neutral-900">Email drafts</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Review what Gennie wrote. Every personal detail is tied to a verified source — open a lead to see the highlights, edit, and approve.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Draft status">
        {FILTERS.map((f) => {
          const n = f.statuses.reduce((sum, s) => sum + counts[s], 0);
          const on = f.key === active.key;
          return (
            <Link
              key={f.key} href={`/dashboard/leads/drafts?status=${f.key}`} role="tab" aria-selected={on}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                on ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {f.label} <span className="tabular-nums">{n}</span>
            </Link>
          );
        })}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center px-6 py-16">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
            <Mail className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="font-semibold text-neutral-900">Nothing here</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-neutral-500">Select leads on the All leads tab and choose “Generate emails”, or open a single lead to write one.</p>
        </div>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
          {items.map((d) => {
            const s = STATUS_STYLE[d.status];
            return (
              <li key={d.id}>
                <Link href={`/dashboard/leads/${d.leadId}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-neutral-50 transition-colors">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-neutral-900">{d.leadName}{d.company && <span className="font-normal text-neutral-500"> · {d.company}</span>}</span>
                    <span className="block truncate text-xs text-neutral-500">{d.subject || "(no subject)"}</span>
                  </span>
                  {d.errorCount > 0 && <span className="text-xs text-rose-600 font-medium">{d.errorCount} problem{d.errorCount === 1 ? "" : "s"}</span>}
                  {d.warningCount > 0 && <span className="text-xs text-amber-600 font-medium">{d.warningCount} warning{d.warningCount === 1 ? "" : "s"}</span>}
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
                  <span className="w-24 text-right text-xs tabular-nums text-neutral-400">{new Date(d.updatedAt).toLocaleDateString()}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
