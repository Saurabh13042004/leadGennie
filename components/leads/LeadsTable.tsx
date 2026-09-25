"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowsDownUp, FunnelSimple, UploadSimple, UsersThree } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { deleteLead } from "@/lib/actions/leads";
import { leadListQueryString, type LeadListQuery, type LeadSortKey } from "@/lib/domain/leads/list-query";
import type { LeadListRow } from "@/lib/db/leads-list";
import LeadFormModal from "./LeadFormModal";
import LeadsBulkBar from "./LeadsBulkBar";
import LeadRow from "./LeadRow";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";

function SortHeader({ label, sortKey, query }: { label: string; sortKey: LeadSortKey; query: LeadListQuery }) {
  const active = query.sort === sortKey;
  const nextDir = active && query.dir === "asc" ? "desc" : "asc";
  const Arrow = !active ? ArrowsDownUp : query.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link
      href={`/dashboard/leads${leadListQueryString({ ...query, sort: sortKey, dir: nextDir, page: 1 })}`}
      className={cn("group/sort inline-flex items-center gap-1 transition-colors hover:text-neutral-900", active && "text-neutral-900")}
    >
      {label}
      <Arrow className={cn("h-3 w-3", active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60")} weight="bold" />
    </Link>
  );
}

const th = "px-3 py-2 font-medium";

export default function LeadsTable({
  rows, query, canEdit, canDelete, canResearch = false, hasAnyLeads,
}: {
  rows: LeadListRow[];
  query: LeadListQuery;
  canEdit: boolean;
  canDelete: boolean;
  canResearch?: boolean;
  hasAnyLeads: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<LeadListRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [, startTransition] = useTransition();

  // Selection belongs to the page you're looking at — drop it when the rows change.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    setSelected(new Set());
  }

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const selectable = canEdit || canDelete || canResearch;

  function handleDelete(id: number, name: string) {
    if (!confirm(`Delete ${name}? This can't be undone.`)) return;
    setBusyId(id);
    setError(null);
    startTransition(async () => {
      try {
        await deleteLead(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete lead");
      } finally {
        setBusyId(null);
      }
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  if (rows.length === 0) {
    return hasAnyLeads ? (
      <EmptyState compact icon={FunnelSimple} title="No leads match these filters" description="Try a different search or clear the filters." />
    ) : (
      <EmptyState
        icon={UsersThree}
        title="No leads yet"
        description="Import a CSV or add a lead from the header to start building your lead universe."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400">
            <UploadSimple className="h-3.5 w-3.5" weight="bold" /> CSV with column mapping, deduped by email
          </span>
        }
      />
    );
  }

  return (
    <div>
      {error && <p className="mx-4 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[13px] text-rose-700 ring-1 ring-inset ring-rose-200 md:mx-6">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-neutral-200/80 bg-neutral-50/60 text-left text-xs text-neutral-500">
              {selectable && (
                <th className="w-10 py-2 pl-4 pr-1 md:pl-6">
                  <Checkbox
                    aria-label="Select all leads on this page"
                    checked={allSelected}
                    onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  />
                </th>
              )}
              <th className={cn(th, !selectable && "pl-4 md:pl-6")}><SortHeader label="Lead" sortKey="name" query={query} /></th>
              <th className={th}><SortHeader label="Company" sortKey="company" query={query} /></th>
              <th className={th}><SortHeader label="ICP fit" sortKey="icp" query={query} /></th>
              <th className={th}>Research</th>
              <th className={th}><SortHeader label="Stage" sortKey="stage" query={query} /></th>
              <th className={th}>Job title</th>
              <th className={th}><SortHeader label="Email" sortKey="email_status" query={query} /></th>
              <th className="w-20 pr-4 md:pr-6"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                selectable={selectable}
                selected={selected.has(lead.id)}
                onToggle={() => toggle(lead.id)}
                canEdit={canEdit}
                canDelete={canDelete}
                busy={busyId === lead.id}
                onEdit={() => setEditing(lead)}
                onDelete={() => handleDelete(lead.id, lead.full_name)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selectable && <LeadsBulkBar selectedIds={selectedIds} canEdit={canEdit} canDelete={canDelete} canResearch={canResearch} onClear={() => setSelected(new Set())} />}

      {editing && (
        <LeadFormModal
          lead={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh(); }}
        />
      )}
    </div>
  );
}
