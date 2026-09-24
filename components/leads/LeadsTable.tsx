"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteLead } from "@/lib/actions/leads";
import { leadListQueryString, type LeadListQuery, type LeadSortKey } from "@/lib/domain/leads/list-query";
import type { LeadListRow } from "@/lib/db/leads-list";
import LeadFormModal from "./LeadFormModal";
import LeadsBulkBar from "./LeadsBulkBar";
import LeadRow from "./LeadRow";

function SortHeader({ label, sortKey, query }: { label: string; sortKey: LeadSortKey; query: LeadListQuery }) {
  const active = query.sort === sortKey;
  const nextDir = active && query.dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={`/dashboard/leads${leadListQueryString({ ...query, sort: sortKey, dir: nextDir, page: 1 })}`}
      className={cn("inline-flex items-center gap-1 hover:text-neutral-900", active && "text-neutral-900")}
    >
      {label}
      {active && (query.dir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
    </Link>
  );
}

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
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
          <Users className="w-6 h-6 text-indigo-500" />
        </div>
        <p className="text-neutral-900 font-semibold">{hasAnyLeads ? "No leads match these filters" : "No leads yet"}</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          {hasAnyLeads ? "Try a different search or clear the filters." : "Import a CSV or add a lead above to start building your lead universe."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}
      {selectable && <LeadsBulkBar selectedIds={selectedIds} canEdit={canEdit} canDelete={canDelete} canResearch={canResearch} onClear={() => setSelected(new Set())} />}

      <div className="rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-bold uppercase tracking-wide text-neutral-500">
                {selectable && (
                  <th className="pl-4 pr-1 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                      className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-200"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-bold"><SortHeader label="Lead" sortKey="name" query={query} /></th>
                <th className="px-4 py-3 font-bold"><SortHeader label="Company" sortKey="company" query={query} /></th>
                <th className="px-4 py-3 font-bold"><SortHeader label="ICP" sortKey="icp" query={query} /></th>
                <th className="px-4 py-3 font-bold">Research</th>
                <th className="px-4 py-3 font-bold"><SortHeader label="Stage" sortKey="stage" query={query} /></th>
                <th className="px-4 py-3 font-bold">Job title</th>
                <th className="px-4 py-3 font-bold"><SortHeader label="Email" sortKey="email_status" query={query} /></th>
                <th className="px-4 py-3 font-bold">LinkedIn</th>
                {(canEdit || canDelete) && <th className="px-4 py-3 font-bold text-right">Actions</th>}
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
      </div>

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
