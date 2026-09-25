import { notFound } from "next/navigation";
import { CircleNotch, MagnifyingGlass, Warning, WarningOctagon } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { getLead } from "@/lib/actions/leads";
import { getIntelligence } from "@/lib/actions/intelligence";
import { getLeadDraft, getTone } from "@/lib/actions/personalization";
import { isIntelligenceConfigured } from "@/lib/intelligence/client";
import { classifyEmail } from "@/lib/domain/leads/email";
import PageHeader from "@/components/ui/PageHeader";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import LeadProperties, { SidebarSection } from "@/components/leads/LeadProperties";
import ResearchActions from "@/components/leads/intel/ResearchActions";
import ScoreHeader from "@/components/leads/intel/ScoreHeader";
import WhyFit from "@/components/leads/intel/WhyFit";
import SignalsPanel from "@/components/leads/intel/SignalsPanel";
import Narrative from "@/components/leads/intel/Narrative";
import EvidencePanel from "@/components/leads/intel/EvidencePanel";
import UnverifiedPanel from "@/components/leads/intel/UnverifiedPanel";
import CompanyCard from "@/components/leads/intel/CompanyCard";
import Callout from "@/components/leads/intel/Callout";
import DraftPanel from "@/components/leads/draft/DraftPanel";

export const metadata = {
  title: "Lead | LeadGennie",
};

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const leadId = Number(id);
  const [session, lead, intel, draft, tone] = await Promise.all([auth(), getLead(leadId), getIntelligence(leadId), getLeadDraft(leadId), getTone()]);
  if (!lead || !intel) notFound();

  const canResearch = session?.user?.role !== "viewer";
  const reasons = lead.email ? classifyEmail(lead.email).reasons : [];
  const status = intel.researchStatus;
  const busy = status === "queued" || status === "running";
  const research = intel.research;
  const partial = research?.status === "partial" || research?.warnings.some((w) => w.startsWith("budget_exhausted"));
  const noWebsite = !lead.company_domain;

  return (
    <>
      <PageHeader
        crumbs={[{ label: "Leads", href: "/dashboard/leads" }]}
        title={
          <span className="flex items-center gap-2">
            <Avatar name={lead.full_name} size="xs" />
            {lead.full_name}
          </span>
        }
        actions={<ResearchActions leadId={lead.id} researchStatus={status} hasResearch={!!research} canResearch={canResearch} engineConfigured={isIntelligenceConfigured()} />}
      />

      <div className="grid lg:min-h-[calc(100%-57px)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4 px-4 py-5 md:px-6 lg:py-6">
          {busy && (
            <Callout tone="info" icon={CircleNotch} spin role="status" title="Gennie is researching this lead">
              This page updates automatically. It usually takes a minute or two.
            </Callout>
          )}
          {status === "failed" && (
            <Callout tone="error" icon={WarningOctagon} role="alert" title="Research failed">
              {intel.lastError ? `${intel.lastError.replace(/\.?\s*$/, ".")} ` : ""}Nothing was saved from the failed run{research ? "; the previous research is still shown below" : ""}.
            </Callout>
          )}
          {partial && (
            <Callout tone="warn" icon={Warning} title="Partial result">
              The research hit its time or cost limit, so some information may be missing. You can re-research to try again.
            </Callout>
          )}

          {!research && !busy && status !== "failed" && (
            <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/40">
              <EmptyState
                compact
                icon={MagnifyingGlass}
                title="Not researched yet"
                description={
                  <>
                    Gennie looks at the company&apos;s public pages, job listings and news, checks every claim against its source, and scores the lead against your ICP.
                    {noWebsite && " Adding the company's website first gives much better results."}
                  </>
                }
              />
            </div>
          )}

          {research && (
            <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
              <ScoreHeader intel={intel} />
              <WhyFit items={research.whyFit} />
            </div>
          )}
          {research && <Narrative research={research} />}
          {research && <SignalsPanel signals={intel.verifiedSignals} />}

          <DraftPanel leadId={lead.id} initial={draft} defaultTone={tone} canEdit={canResearch} hasEvidence={intel.verifiedSourceCount > 0} />

          {research && (
            <>
              <EvidencePanel evidence={[...intel.verifiedSignals.flatMap((s) => s.evidence), ...intel.otherEvidence.filter((e) => e.verified)].sort((a, b) => a.id - b.id)} sourceCount={intel.verifiedSourceCount} />
              <UnverifiedPanel signals={intel.unverifiedSignals} />
              {research.unknowns.length > 0 && (
                <p className="px-1 text-xs text-neutral-500">Couldn&apos;t find: {research.unknowns.join(", ")}.</p>
              )}
            </>
          )}
        </div>

        <aside className="order-first border-b border-neutral-200/80 bg-neutral-50/40 lg:order-none lg:border-b-0 lg:border-l">
          <LeadProperties lead={lead} intel={intel} emailReasons={reasons} />
          {intel.company && (
            <SidebarSection title="Company">
              <CompanyCard company={intel.company} />
            </SidebarSection>
          )}
          {intel.candidates.length > 0 && (
            <SidebarSection title="Other people at this company">
              <p className="-mt-1 mb-2.5 text-xs text-neutral-400">Found on public pages. Suggestions only — add them as leads yourself.</p>
              <ul className="space-y-2">
                {intel.candidates.map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 text-[13px]">
                    <Avatar name={c.name} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-neutral-800">{c.name}</span>
                      {c.title && <span className="block truncate text-xs text-neutral-400">{c.title}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </SidebarSection>
          )}
        </aside>
      </div>
    </>
  );
}
