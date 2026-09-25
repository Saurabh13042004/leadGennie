import Link from "next/link";
import { CircleNotch, LinkedinLogo, PencilSimple, Trash } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import type { LeadListRow } from "@/lib/db/leads-list";
import Avatar, { CompanyMark } from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import Checkbox from "@/components/ui/Checkbox";
import EmailStatusBadge from "./EmailStatusBadge";
import ScoreChip from "./ScoreChip";
import ResearchStatusBadge from "./ResearchStatusBadge";

const STAGE_TONE: Record<string, Tone> = { new: "neutral", qualified: "sky", outreached: "indigo", engaged: "emerald", replied: "violet", won: "emerald", lost: "rose" };

const td = "px-3 py-2 align-middle";

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
  const company = lead.company_name ?? lead.company;
  return (
    <tr className={cn("group transition-colors", selected ? "bg-indigo-50/50" : "hover:bg-neutral-50/80")}>
      {selectable && (
        <td className="w-10 py-2 pl-4 pr-1 md:pl-6">
          <Checkbox aria-label={`Select ${lead.full_name}`} checked={selected} onChange={onToggle} />
        </td>
      )}
      <td className={cn(td, "min-w-[220px]", !selectable && "pl-4 md:pl-6")}>
        <div className="flex items-center gap-2.5">
          <Avatar name={lead.full_name} size="md" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Link href={`/dashboard/leads/${lead.id}`} className="truncate font-medium text-neutral-900 hover:text-indigo-600">
                {lead.full_name}
              </Link>
              {lead.linkedin_url && (
                <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn profile" className="text-neutral-300 transition-colors hover:text-[#0a66c2]">
                  <LinkedinLogo className="h-3.5 w-3.5" weight="fill" />
                </a>
              )}
            </div>
            <p className="truncate text-xs text-neutral-500">{lead.email ?? "No email"}</p>
          </div>
        </div>
      </td>
      <td className={cn(td, "min-w-[180px]")}>
        {company ? (
          <div className="flex items-center gap-2">
            <CompanyMark name={company} size="sm" />
            <div className="min-w-0">
              {lead.company_id ? (
                <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="block truncate text-neutral-800 hover:text-indigo-600" title="Show all leads at this company">
                  {company}
                </Link>
              ) : (
                <span className="block truncate text-neutral-800">{company}</span>
              )}
              {lead.company_domain && <p className="truncate text-[11px] text-neutral-400">{lead.company_domain}</p>}
            </div>
          </div>
        ) : (
          <span className="text-neutral-300">—</span>
        )}
      </td>
      <td className={td}><ScoreChip score={lead.icp_score} qualified={lead.qualified} /></td>
      <td className={cn(td, "min-w-[150px]")}>
        <ResearchStatusBadge status={lead.research_status} />
        {lead.signal_types.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {lead.signal_types.slice(0, 3).map((t) => (
              <Badge key={t} tone="amber" className="h-[18px] px-1 text-[10px] capitalize">{t.replace("_", " ").toLowerCase()}</Badge>
            ))}
          </div>
        )}
      </td>
      <td className={td}>
        <Badge tone={STAGE_TONE[lead.stage] ?? "neutral"} dot className="capitalize">{lead.stage}</Badge>
      </td>
      <td className={cn(td, "max-w-[200px] truncate text-neutral-600")}>{lead.job_title || <span className="text-neutral-300">—</span>}</td>
      <td className={td}>
        {lead.email ? <EmailStatusBadge status={lead.email_status} blocked={lead.blocked} /> : <span className="text-xs text-neutral-400">No email</span>}
      </td>
      <td className="w-20 py-2 pl-2 pr-4 md:pr-6">
        {(canEdit || canDelete) && (
          <div className={cn("flex items-center justify-end gap-0.5 transition-opacity", busy ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100")}>
            {canEdit && (
              <button onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-900" aria-label="Edit lead">
                <PencilSimple className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                aria-label="Delete lead"
              >
                {busy ? <CircleNotch className="h-4 w-4 animate-spin" /> : <Trash className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
