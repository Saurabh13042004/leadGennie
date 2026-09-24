import { auth } from "@/auth";
import { getLeadsPage } from "@/lib/actions/leads";
import type { RawSearchParams } from "@/lib/domain/leads/list-query";
import LeadsHeader from "@/components/leads/LeadsHeader";
import LeadsTable from "@/components/leads/LeadsTable";
import LeadsSubNav from "@/components/leads/LeadsSubNav";
import LeadsFilters from "@/components/leads/LeadsFilters";
import LeadsPager from "@/components/leads/LeadsPager";

export const metadata = {
  title: "All Leads | LeadGennie",
};

export default async function LeadsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const [session, { query, page }] = await Promise.all([auth(), searchParams.then(getLeadsPage)]);
  const role = session?.user?.role;
  const canEdit = role !== "viewer";
  const canDelete = role === "owner" || role === "admin";
  const canResearch = role !== "viewer";
  const hasAnyLeads = page.facets.stages.some((s) => s.count > 0);
  const companyName = query.companyId ? (page.rows.find((r) => r.company_id === query.companyId)?.company_name ?? null) : null;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <LeadsSubNav />
      <LeadsHeader canEdit={canEdit} />

      <div className="space-y-4">
        {hasAnyLeads && <LeadsFilters query={query} stages={page.facets.stages} sources={page.facets.sources} companyName={companyName} />}
        <LeadsTable rows={page.rows} query={query} canEdit={canEdit} canDelete={canDelete} canResearch={canResearch} hasAnyLeads={hasAnyLeads} />
        {page.total > 0 && (
          <LeadsPager query={query} page={page.page} pageCount={page.pageCount} total={page.total} pageSize={page.pageSize} />
        )}
      </div>
    </div>
  );
}
