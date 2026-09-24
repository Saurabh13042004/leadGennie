"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { leadListQueryString, type LeadListQuery } from "@/lib/domain/leads/list-query";
import type { Facet } from "@/lib/db/leads-list";

const selectCls =
  "bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300";

export default function LeadsFilters({
  query, stages, sources, companyName,
}: {
  query: LeadListQuery;
  stages: Facet[];
  sources: Facet[];
  companyName: string | null;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(query.search);

  // Any filter change goes back to page 1.
  const go = (patch: Partial<LeadListQuery>) => router.push(`/dashboard/leads${leadListQueryString({ ...query, ...patch, page: 1 })}`);
  const active = !!(query.search || query.stage || query.source || query.emailStatus || query.companyId || query.research || query.minScore);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3 flex flex-wrap items-center gap-2">
      <form onSubmit={(e) => { e.preventDefault(); go({ search: search.trim() }); }} className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, title…"
          aria-label="Search leads"
          className="w-full rounded-lg bg-neutral-50 border border-neutral-200 pl-9 pr-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
        />
      </form>

      <select aria-label="Filter by stage" value={query.stage} onChange={(e) => go({ stage: e.target.value })} className={selectCls}>
        <option value="">All stages</option>
        {stages.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count})</option>)}
      </select>
      <select aria-label="Filter by source" value={query.source} onChange={(e) => go({ source: e.target.value })} className={selectCls}>
        <option value="">All sources</option>
        {sources.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count})</option>)}
      </select>
      <select
        aria-label="Filter by email status"
        value={query.emailStatus}
        onChange={(e) => go({ emailStatus: e.target.value as LeadListQuery["emailStatus"] })}
        className={selectCls}
      >
        <option value="">Any email status</option>
        <option value="valid">Valid</option>
        <option value="unverified">Unverified</option>
        <option value="risky">Risky</option>
        <option value="invalid">Invalid</option>
        <option value="none">No email</option>
      </select>

      <select aria-label="Filter by research status" value={query.research} onChange={(e) => go({ research: e.target.value as LeadListQuery["research"] })} className={selectCls}>
        <option value="">Any research status</option>
        <option value="researched">Researched</option>
        <option value="none">Not researched</option>
        <option value="running">In progress</option>
        <option value="failed">Failed</option>
      </select>
      <select aria-label="Filter by minimum ICP score" value={query.minScore} onChange={(e) => go({ minScore: Number(e.target.value) })} className={selectCls}>
        <option value={0}>Any ICP score</option>
        <option value={80}>ICP ≥ 80</option>
        <option value={60}>ICP ≥ 60</option>
        <option value={40}>ICP ≥ 40</option>
      </select>

      {query.companyId && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 text-xs px-3 py-1.5">
          Company: {companyName ?? `#${query.companyId}`}
          <button onClick={() => go({ companyId: null })} aria-label="Clear company filter" className="hover:text-indigo-900"><X className="w-3 h-3" /></button>
        </span>
      )}
      {active && (
        <button
          onClick={() => { setSearch(""); router.push("/dashboard/leads"); }}
          className="text-xs text-neutral-500 hover:text-neutral-900 underline underline-offset-2 ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
