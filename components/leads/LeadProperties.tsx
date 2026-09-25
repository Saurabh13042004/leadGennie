import type { ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  Buildings,
  CalendarBlank,
  EnvelopeSimple,
  Flag,
  LinkedinLogo,
  MagnifyingGlass,
  Phone,
  SignIn,
  Target,
} from "@phosphor-icons/react/ssr";
import type { NavIcon } from "@/lib/nav-config";
import type { LeadDetail } from "@/lib/db/leads-list";
import type { LeadIntelligence } from "@/lib/intelligence/read-model";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import Avatar, { CompanyMark } from "@/components/ui/Avatar";
import Badge, { type Tone } from "@/components/ui/Badge";
import EmailStatusBadge from "./EmailStatusBadge";
import ResearchStatusBadge from "./ResearchStatusBadge";
import ScoreChip from "./ScoreChip";

const STAGE_TONE: Record<string, Tone> = { new: "neutral", qualified: "sky", outreached: "indigo", engaged: "emerald", replied: "violet", won: "emerald", lost: "rose" };

const Empty = () => <span className="text-neutral-300">—</span>;

function Prop({ icon: Icon, label, children }: { icon: NavIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_minmax(0,1fr)] items-start gap-3 py-1.5">
      <dt className="flex items-center gap-2 pt-px text-neutral-500">
        <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-400" weight="duotone" />
        {label}
      </dt>
      <dd className="min-w-0 text-neutral-900">{children}</dd>
    </div>
  );
}

export function SidebarSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-neutral-200/80 px-4 py-4 md:px-5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-medium text-neutral-500">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Attio-style record sidebar: identity on top, then a calm key/value list of the lead's properties. */
export default function LeadProperties({ lead, intel, emailReasons }: { lead: LeadDetail; intel: LeadIntelligence; emailReasons: string[] }) {
  const companyLabel = lead.company_name ?? lead.company;
  const subtitle = [lead.job_title, companyLabel].filter(Boolean).join(" at ");
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-5 md:px-5">
        <Avatar name={lead.full_name} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight text-neutral-900">{lead.full_name}</p>
          <p className="truncate text-[13px] text-neutral-500">{subtitle || "No title or company yet"}</p>
        </div>
      </div>

      <SidebarSection title="Properties">
        <dl className="text-[13px]">
          <Prop icon={Buildings} label="Company">
            {companyLabel ? (
              <span className="flex items-center gap-2">
                <CompanyMark name={companyLabel} size="xs" />
                {lead.company_id ? (
                  <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="truncate hover:text-indigo-600" title="Show all leads at this company">
                    {companyLabel}
                  </Link>
                ) : (
                  <span className="truncate">{companyLabel}</span>
                )}
              </span>
            ) : (
              <Empty />
            )}
          </Prop>
          <Prop icon={Briefcase} label="Job title">{lead.job_title || <Empty />}</Prop>
          <Prop icon={EnvelopeSimple} label="Email">
            {lead.email ? (
              <>
                <span className="block truncate" title={lead.email}>{lead.email}</span>
                <span className="mt-1 block"><EmailStatusBadge status={lead.email_status} blocked={lead.blocked} /></span>
                {emailReasons.length > 0 && <span className="mt-1 block text-xs text-amber-700">{emailReasons.join(" · ")}</span>}
                {lead.blocked && <span className="mt-1 block text-xs text-orange-700">On your Do Not Contact list — this lead can&apos;t be enrolled in campaigns.</span>}
              </>
            ) : (
              <span className="text-neutral-400">No email</span>
            )}
          </Prop>
          <Prop icon={Phone} label="Phone">{lead.phone || <Empty />}</Prop>
          <Prop icon={LinkedinLogo} label="LinkedIn">
            {lead.linkedin_url ? (
              <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="block truncate text-indigo-600 hover:text-indigo-800" title={lead.linkedin_url}>
                {lead.linkedin_url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
              </a>
            ) : (
              <Empty />
            )}
          </Prop>
          <Prop icon={Flag} label="Stage">
            <Badge tone={STAGE_TONE[lead.stage] ?? "neutral"} dot className="capitalize">{lead.stage}</Badge>
          </Prop>
          <Prop icon={SignIn} label="Source">
            {lead.source_url ? (
              <a href={lead.source_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">{lead.source}</a>
            ) : (
              <Badge tone="neutral">{lead.source}</Badge>
            )}
          </Prop>
          <Prop icon={CalendarBlank} label="Created">{new Date(lead.created_at).toLocaleDateString()}</Prop>
        </dl>
      </SidebarSection>

      <SidebarSection title="Intelligence">
        <dl className="text-[13px]">
          <Prop icon={MagnifyingGlass} label="Research">
            <ResearchStatusBadge status={intel.researchStatus} />
            {intel.researchedAt && <span className="mt-0.5 block text-xs text-neutral-400">{new Date(intel.researchedAt).toLocaleDateString()}</span>}
          </Prop>
          <Prop icon={Target} label="ICP fit"><ScoreChip score={intel.icpScore} qualified={intel.qualified} /></Prop>
        </dl>
      </SidebarSection>
    </>
  );
}
