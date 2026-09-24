import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { leadListQueryString, type LeadListQuery } from "@/lib/domain/leads/list-query";

export default function LeadsPager({
  query, page, pageCount, total, pageSize,
}: {
  query: LeadListQuery;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const href = (p: number) => `/dashboard/leads${leadListQueryString({ ...query, page: p })}`;
  const btn = "inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium";
  return (
    <div className="flex items-center justify-between text-xs text-neutral-500">
      <p className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">Page {page} of {pageCount}</span>
        {page > 1 ? (
          <Link href={href(page - 1)} className={`${btn} text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300`} aria-label="Previous page">
            <ChevronLeft className="w-3.5 h-3.5" /> Prev
          </Link>
        ) : (
          <span className={`${btn} opacity-40`}><ChevronLeft className="w-3.5 h-3.5" /> Prev</span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={`${btn} text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300`} aria-label="Next page">
            Next <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        ) : (
          <span className={`${btn} opacity-40`}>Next <ChevronRight className="w-3.5 h-3.5" /></span>
        )}
      </div>
    </div>
  );
}
