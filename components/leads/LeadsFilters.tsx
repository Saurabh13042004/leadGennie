"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Buildings, CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { leadListQueryString, type LeadListQuery } from "@/lib/domain/leads/list-query";
import type { Facet } from "@/lib/db/leads-list";

/** Native select dressed as a filter pill; tinted when a value is applied. */
function FilterPill({ label, value, onChange, children }: { label: string; value: string | number; onChange: (v: string) => void; children: ReactNode }) {
  const on = value !== "" && value !== 0;
  return (
    <label
      className={cn(
        "relative inline-flex h-8 items-center rounded-lg text-[13px] ring-1 ring-inset transition-colors",
        on ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
      )}
    >
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="h-full cursor-pointer appearance-none bg-transparent pl-2.5 pr-7 font-medium focus:outline-none">
        {children}
      </select>
      <CaretDown className="pointer-events-none absolute right-2 h-3 w-3 opacity-60" weight="bold" />
    </label>
  );
}

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
    <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200/80 px-4 py-2.5 md:px-6">
      <form onSubmit={(e) => { e.preventDefault(); go({ search: search.trim() }); }} className="relative w-full sm:w-72">
        <MagnifyingGlass className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" weight="bold" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email, company, title…"
          aria-label="Search leads"
          className="h-8 w-full rounded-lg bg-neutral-50 pl-8 pr-3 text-[13px] text-neutral-900 ring-1 ring-inset ring-neutral-200/80 placeholder:text-neutral-400 transition-shadow focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
        />
      </form>

      <FilterPill label="Filter by stage" value={query.stage} onChange={(v) => go({ stage: v })}>
        <option value="">Stage</option>
        {stages.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count})</option>)}
      </FilterPill>
      <FilterPill label="Filter by source" value={query.source} onChange={(v) => go({ source: v })}>
        <option value="">Source</option>
        {sources.map((f) => <option key={f.value} value={f.value}>{f.value} ({f.count})</option>)}
      </FilterPill>
      <FilterPill label="Filter by email status" value={query.emailStatus} onChange={(v) => go({ emailStatus: v as LeadListQuery["emailStatus"] })}>
        <option value="">Email status</option>
        <option value="valid">Valid</option>
        <option value="unverified">Unverified</option>
        <option value="risky">Risky</option>
        <option value="invalid">Invalid</option>
        <option value="none">No email</option>
      </FilterPill>
      <FilterPill label="Filter by research status" value={query.research} onChange={(v) => go({ research: v as LeadListQuery["research"] })}>
        <option value="">Research</option>
        <option value="researched">Researched</option>
        <option value="none">Not researched</option>
        <option value="running">In progress</option>
        <option value="failed">Failed</option>
      </FilterPill>
      <FilterPill label="Filter by minimum ICP score" value={query.minScore} onChange={(v) => go({ minScore: Number(v) })}>
        <option value={0}>ICP score</option>
        <option value={80}>ICP ≥ 80</option>
        <option value={60}>ICP ≥ 60</option>
        <option value={40}>ICP ≥ 40</option>
      </FilterPill>

      {query.companyId && (
        <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-50 pl-2.5 pr-1.5 text-[13px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
          <Buildings className="h-3.5 w-3.5" weight="duotone" />
          {companyName ?? `#${query.companyId}`}
          <button onClick={() => go({ companyId: null })} aria-label="Clear company filter" className="rounded p-0.5 hover:bg-indigo-100">
            <X className="h-3 w-3" weight="bold" />
          </button>
        </span>
      )}
      {active && (
        <button
          onClick={() => { setSearch(""); router.push("/dashboard/leads"); }}
          className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-3.5 w-3.5" weight="bold" />
          Clear
        </button>
      )}
    </div>
  );
}
