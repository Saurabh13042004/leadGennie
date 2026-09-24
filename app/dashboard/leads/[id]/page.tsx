import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Link2, Mail, Phone, Briefcase, AlertTriangle, Loader2 } from "lucide-react";
import { auth } from "@/auth";
import { getLead } from "@/lib/actions/leads";
import { getIntelligence } from "@/lib/actions/intelligence";
import { isIntelligenceConfigured } from "@/lib/intelligence/client";
import { classifyEmail } from "@/lib/domain/leads/email";
import { leadListQueryString } from "@/lib/domain/leads/list-query";
import EmailStatusBadge from "@/components/leads/EmailStatusBadge";
import ResearchActions from "@/components/leads/intel/ResearchActions";
import ScoreHeader from "@/components/leads/intel/ScoreHeader";
import WhyFit from "@/components/leads/intel/WhyFit";
import SignalsPanel from "@/components/leads/intel/SignalsPanel";
import Narrative from "@/components/leads/intel/Narrative";
import EvidencePanel from "@/components/leads/intel/EvidencePanel";
import UnverifiedPanel from "@/components/leads/intel/UnverifiedPanel";
import CompanyCard from "@/components/leads/intel/CompanyCard";

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

function Notice({ tone, icon: Icon, children }: { tone: "info" | "warn" | "error"; icon: typeof Mail; children: React.ReactNode }) {
  const cls = { info: "border-blue-500/20 bg-blue-500/5 text-blue-100/90", warn: "border-yellow-500/20 bg-yellow-500/5 text-yellow-100/90", error: "border-red-500/25 bg-red-500/5 text-red-100/90" }[tone];
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-2.5 ${cls}`}>
      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone === "info" ? "animate-spin" : ""}`} />
      <div>{children}</div>
    </div>
  );
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  const [session, lead, intel] = await Promise.all([auth(), getLead(leadId), getIntelligence(leadId)]);
  if (!lead || !intel) notFound();

  const canResearch = session?.user?.role !== "viewer";
  const reasons = lead.email ? classifyEmail(lead.email).reasons : [];
  const status = intel.researchStatus;
  const busy = status === "queued" || status === "running";
  const research = intel.research;
  const partial = research?.status === "partial" || research?.warnings.some((w) => w.startsWith("budget_exhausted"));
  const noWebsite = !lead.company_domain;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <Link href="/dashboard/leads" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft className="w-4 h-4" /> All leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-white">{lead.full_name}</h1>
          <p className="text-sm text-neutral-500">{[lead.job_title, lead.company_name ?? lead.company].filter(Boolean).join(" · ") || "No title or company yet"}</p>
          <p className="text-xs text-neutral-600 mt-1">
            Stage <span className="text-neutral-400">{lead.stage}</span> · Source <span className="text-neutral-400">{lead.source}</span> · Added {new Date(lead.created_at).toLocaleDateString()}
          </p>
        </div>
        <ResearchActions leadId={lead.id} researchStatus={status} hasResearch={!!research} canResearch={canResearch} engineConfigured={isIntelligenceConfigured()} />
      </div>

      {busy && <Notice tone="info" icon={Loader2}>Gennie is researching this lead — this page updates automatically. It usually takes a minute or two.</Notice>}
      {status === "failed" && (
        <Notice tone="error" icon={AlertTriangle}>
          Research failed{intel.lastError ? `: ${intel.lastError}` : "."} Nothing was saved from the failed run{research ? "; the previous research is still shown below" : ""}.
        </Notice>
      )}
      {partial && <Notice tone="warn" icon={AlertTriangle}>Partial result — the research hit its time or cost limit, so some information may be missing. You can re-research to try again.</Notice>}
      {!research && !busy && status !== "failed" && (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] px-6 py-10 text-center">
          <p className="text-white font-medium">Not researched yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
            Gennie looks at the company&apos;s public pages, job listings and news, checks every claim against its source, and scores the lead against your ICP.
            {noWebsite && " Adding the company's website first gives much better results."}
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-6 min-w-0">
          {research && (
            <>
              <Narrative research={research} />
              <SignalsPanel signals={intel.verifiedSignals} />
              <EvidencePanel evidence={[...intel.verifiedSignals.flatMap((s) => s.evidence), ...intel.otherEvidence.filter((e) => e.verified)].sort((a, b) => a.id - b.id)} sourceCount={intel.verifiedSourceCount} />
              <UnverifiedPanel signals={intel.unverifiedSignals} />
              {research.unknowns.length > 0 && (
                <p className="text-xs text-neutral-500">Couldn&apos;t find: {research.unknowns.join(", ")}.</p>
              )}
            </>
          )}
        </div>

        <aside className="space-y-6">
          {research && <ScoreHeader intel={intel} />}
          {research && <WhyFit items={research.whyFit} />}
          {intel.company && <CompanyCard company={intel.company} />}

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
                <Link href={`/dashboard/leads${leadListQueryString({ companyId: lead.company_id })}`} className="hover:underline">{lead.company_name}</Link>
              ) : (
                lead.company || <span className="text-neutral-500">—</span>
              )}
              {lead.company_domain && <span className="text-neutral-500"> · {lead.company_domain}</span>}
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

          {intel.candidates.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#0A0A0A] p-5">
              <h2 className="text-sm font-semibold text-white">Other people at this company</h2>
              <p className="text-xs text-neutral-500 mt-1">Found on public pages. Suggestions only — add them as leads yourself.</p>
              <ul className="mt-3 space-y-2 text-sm">
                {intel.candidates.map((c) => (
                  <li key={c.id} className="text-neutral-200">{c.name}{c.title && <span className="text-neutral-500"> — {c.title}</span>}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
