import Link from "next/link";
import { Link2, Pencil, Trash2, Loader2 } from "lucide-react";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import type { LeadListRow } from "@/lib/db/leads-list";
import EmailStatusBadge from "./EmailStatusBadge";
import ScoreChip from "./ScoreChip";
import ResearchStatusBadge from "./ResearchStatusBadge";

const STAGE_STYLES: Record<string, string> = {
  new: "bg-neutral-100 text-neutral-600 ring-1 ring-inset ring-neutral-200",
  outreached: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  engaged: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
};

/** One row of the leads table. Split out of LeadsTable so the table shell stays focused on layout/selection. */
export default function LeadRow({
  lead, selectable, selected, onToggle, canEdit, canDelete, busy, onEdit, onDelete,
}: {
  lead: LeadListRow;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
  canEdit: boolean;
  canDelete: boolean;
  busy: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="hover:bg-neutral-50 transition-colors">
      {selectable && (
        <td className="pl-4 pr-1 py-3">
          <input
            type="checkbox"
            aria-label={`Select ${lead.full_name}`}
            checked={selected}
            onChange={onToggle}
            className="rounded border-neutral-300 text-indigo-600 focus:ring-indigo-200"
          />
        </td>
      )}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-semibold text-indigo-700 shrink-0">
            {lead.full_name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div className="min-w-0">
            <Link href={`/dashboard/leads/${lead.id}`} className="text-neutral-900 font-medium hover:text-indigo-600 transition-colors">{lead.full_name}</Link>
            {lead.email && <p className="text-xs text-neutral-500 truncate">{lead.email}</p>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-neutral-700">
        {lead.company_id ? (
          <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="hover:text-indigo-600 transition-colors" title="Show all leads at this company">
            {lead.company_name ?? lead.company}
          </Link>
        ) : (
          lead.company || "—"
        )}
        {lead.company_domain && <p className="text-xs text-neutral-400">{lead.company_domain}</p>}
      </td>
      <td className="px-4 py-3"><ScoreChip score={lead.icp_score} qualified={lead.qualified} /></td>
      <td className="px-4 py-3">
        <ResearchStatusBadge status={lead.research_status} />
        {lead.signal_types.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {lead.signal_types.slice(0, 3).map((t) => (
              <span key={t} className="text-[10px] uppercase tracking-wide rounded bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 px-1.5 py-0.5">{t.replace("_", " ").toLowerCase()}</span>
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs font-medium rounded-full px-2.5 py-1 ${STAGE_STYLES[lead.stage] ?? STAGE_STYLES.new}`}>{lead.stage}</span>
      </td>
      <td className="px-4 py-3 text-neutral-700">{lead.job_title || "—"}</td>
      <td className="px-4 py-3">
        {lead.email ? <EmailStatusBadge status={lead.email_status} blocked={lead.blocked} /> : <span className="text-neutral-400">No email</span>}
      </td>
      <td className="px-4 py-3">
        {lead.linkedin_url ? (
          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700">
            <Link2 className="w-3.5 h-3.5" /> Profile
          </a>
        ) : (
          <span className="text-neutral-400">—</span>
        )}
      </td>
      {(canEdit || canDelete) && (
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-3">
            {canEdit && (
              <button onClick={onEdit} className="text-neutral-400 hover:text-neutral-900 transition-colors" aria-label="Edit lead">
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="text-neutral-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                aria-label="Delete lead"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        </td>
      )}
    </tr>
  );
}
