import Link from "next/link";
import { CaretLeft, CaretRight } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
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
  const btn = "flex h-7 w-7 items-center justify-center rounded-md ring-1 ring-inset ring-neutral-200 bg-white";
  return (
    <div className="flex items-center justify-between px-4 py-3 text-xs text-neutral-500 md:px-6">
      <p className="tabular-nums">
        <span className="font-medium text-neutral-800">{from.toLocaleString()}–{to.toLocaleString()}</span> of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">Page {page} of {pageCount}</span>
        {page > 1 ? (
          <Link href={href(page - 1)} className={cn(btn, "text-neutral-700 hover:bg-neutral-50")} aria-label="Previous page">
            <CaretLeft className="h-3.5 w-3.5" weight="bold" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}><CaretLeft className="h-3.5 w-3.5" weight="bold" /></span>
        )}
        {page < pageCount ? (
          <Link href={href(page + 1)} className={cn(btn, "text-neutral-700 hover:bg-neutral-50")} aria-label="Next page">
            <CaretRight className="h-3.5 w-3.5" weight="bold" />
          </Link>
        ) : (
          <span className={cn(btn, "opacity-40")}><CaretRight className="h-3.5 w-3.5" weight="bold" /></span>
        )}
      </div>
    </div>
  );
}
