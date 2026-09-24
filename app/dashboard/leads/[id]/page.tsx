import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Link2, Mail, Phone, Briefcase } from "lucide-react";
import { getLead } from "@/lib/actions/leads";
import { classifyEmail } from "@/lib/domain/leads/email";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import EmailStatusBadge from "@/components/leads/EmailStatusBadge";

export const metadata = {
  title: "Lead | LeadGennie",
};

function Row({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-white/5 last:border-0">
      <Icon className="w-4 h-4 text-neutral-500 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-neutral-500">{label}</p>
        <div className="text-sm text-white mt-0.5 break-words">{children}</div>
      </div>
    </div>
  );
}

/** Minimal lead view (Phase 1). The full lead + company pages, with research, land in Phase 2. */
export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await getLead(Number(id));
  if (!lead) notFound();

  const reasons = lead.email ? classifyEmail(lead.email).reasons : [];

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> All leads
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-white">{lead.full_name}</h1>
        <p className="text-sm text-neutral-500">
          {[lead.job_title, lead.company_name ?? lead.company].filter(Boolean).join(" · ") || "No title or company yet"}
        </p>
        <p className="text-xs text-neutral-600 mt-1">
          Stage <span className="text-neutral-400">{lead.stage}</span> · Source <span className="text-neutral-400">{lead.source}</span> · Added{" "}
          {new Date(lead.created_at).toLocaleDateString()}
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0A0A0A] px-4">
        <Row icon={Mail} label="Email">
          {lead.email ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              {lead.email} <EmailStatusBadge status={lead.email_status} blocked={lead.blocked} />
            </span>
          ) : (
            <span className="text-neutral-500">No email</span>
          )}
          {reasons.length > 0 && <p className="text-xs text-yellow-200/80 mt-1">{reasons.join(" · ")}</p>}
          {lead.blocked && <p className="text-xs text-orange-300/90 mt-1">On your Do Not Contact list — this lead can&apos;t be enrolled in campaigns.</p>}
        </Row>
        <Row icon={Building2} label="Company">
          {lead.company_id ? (
            <span>
              <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="hover:underline">
                {lead.company_name}
              </Link>
              {lead.company_domain && <span className="text-neutral-500"> · {lead.company_domain}</span>}
              <span className="block text-xs text-neutral-600 mt-0.5">Click to see every lead at this company. The full company page arrives with research.</span>
            </span>
          ) : (
            lead.company || <span className="text-neutral-500">—</span>
          )}
        </Row>
        <Row icon={Briefcase} label="Job title">{lead.job_title || <span className="text-neutral-500">—</span>}</Row>
        <Row icon={Phone} label="Phone">{lead.phone || <span className="text-neutral-500">—</span>}</Row>
        <Row icon={Link2} label="LinkedIn">
          {lead.linkedin_url ? (
            <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{lead.linkedin_url}</a>
          ) : (
            <span className="text-neutral-500">—</span>
          )}
        </Row>
      </div>
    </div>
  );
}
