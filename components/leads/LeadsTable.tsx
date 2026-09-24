"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Link2, Pencil, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteLead } from "@/lib/actions/leads";
import { leadListQueryString, type LeadListQuery, type LeadSortKey } from "@/lib/domain/leads/list-query";
import type { LeadListRow } from "@/lib/db/leads-list";
import LeadFormModal from "./LeadFormModal";
import EmailStatusBadge from "./EmailStatusBadge";
import LeadsBulkBar from "./LeadsBulkBar";
import ScoreChip from "./ScoreChip";
import ResearchStatusBadge from "./ResearchStatusBadge";

const STAGE_STYLES: Record<string, string> = {
  new: "bg-white/5 text-neutral-300 border-white/10",
  outreached: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  engaged: "bg-green-500/10 text-green-300 border-green-500/20",
};

function SortHeader({ label, sortKey, query }: { label: string; sortKey: LeadSortKey; query: LeadListQuery }) {
  const active = query.sort === sortKey;
  const nextDir = active && query.dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={`/dashboard/leads${leadListQueryString({ ...query, sort: sortKey, dir: nextDir, page: 1 })}`}
      className={cn("inline-flex items-center gap-1 hover:text-white", active && "text-white")}
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

  function handleDelete(id: number) {
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

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
        <p className="text-white font-medium">{hasAnyLeads ? "No leads match these filters" : "No leads yet"}</p>
        <p className="text-sm text-neutral-500 mt-1 max-w-sm">
          {hasAnyLeads ? "Try a different search or clear the filters." : "Import a CSV or add a lead above to start building your lead universe."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
      {selectable && <LeadsBulkBar selectedIds={selectedIds} canEdit={canEdit} canDelete={canDelete} canResearch={canResearch} onClear={() => setSelected(new Set())} />}

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-neutral-500">
                {selectable && (
                  <th className="pl-4 pr-1 py-3 w-8">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium"><SortHeader label="Lead" sortKey="name" query={query} /></th>
                <th className="px-4 py-3 font-medium"><SortHeader label="Company" sortKey="company" query={query} /></th>
                <th className="px-4 py-3 font-medium"><SortHeader label="ICP" sortKey="icp" query={query} /></th>
                <th className="px-4 py-3 font-medium">Research</th>
                <th className="px-4 py-3 font-medium"><SortHeader label="Stage" sortKey="stage" query={query} /></th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium"><SortHeader label="Email" sortKey="email_status" query={query} /></th>
                <th className="px-4 py-3 font-medium">LinkedIn</th>
                {(canEdit || canDelete) && <th className="px-4 py-3 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <tr key={lead.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                  {selectable && (
                    <td className="pl-4 pr-1 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${lead.full_name}`}
                        checked={selected.has(lead.id)}
                        onChange={() => setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(lead.id)) next.delete(lead.id); else next.add(lead.id);
                          return next;
                        })}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-semibold text-white shrink-0">
                        {lead.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link href={`/dashboard/leads/${lead.id}`} className="text-white hover:underline">{lead.full_name}</Link>
                        {lead.email && <p className="text-xs text-neutral-500 truncate">{lead.email}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">
                    {lead.company_id ? (
                      <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="hover:underline" title="Show all leads at this company">
                        {lead.company_name ?? lead.company}
                      </Link>
                    ) : (
                      lead.company || "—"
                    )}
                    {lead.company_domain && <p className="text-xs text-neutral-600">{lead.company_domain}</p>}
                  </td>
                  <td className="px-4 py-3"><ScoreChip score={lead.icp_score} qualified={lead.qualified} /></td>
                  <td className="px-4 py-3">
                    <ResearchStatusBadge status={lead.research_status} />
                    {lead.signal_types.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {lead.signal_types.slice(0, 3).map((t) => (
                          <span key={t} className="text-[10px] uppercase tracking-wide rounded border border-orange-500/20 bg-orange-500/10 text-orange-200 px-1.5 py-0.5">{t.replace("_", " ").toLowerCase()}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs border rounded-full px-2.5 py-1 ${STAGE_STYLES[lead.stage] ?? STAGE_STYLES.new}`}>{lead.stage}</span>
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{lead.job_title || "—"}</td>
                  <td className="px-4 py-3">
                    {lead.email ? <EmailStatusBadge status={lead.email_status} blocked={lead.blocked} /> : <span className="text-neutral-600">No email</span>}
                  </td>
                  <td className="px-4 py-3">
                    {lead.linkedin_url ? (
                      <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-400 hover:underline">
                        <Link2 className="w-3.5 h-3.5" /> Profile
                      </a>
                    ) : (
                      <span className="text-neutral-600">—</span>
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {canEdit && (
                          <button onClick={() => setEditing(lead)} className="text-neutral-500 hover:text-white transition-colors" aria-label="Edit lead">
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={() => { if (confirm(`Delete ${lead.full_name}? This can't be undone.`)) handleDelete(lead.id); }}
                            disabled={busyId === lead.id}
                            className="text-neutral-500 hover:text-red-400 transition-colors disabled:opacity-50"
                            aria-label="Delete lead"
                          >
                            {busyId === lead.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
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
