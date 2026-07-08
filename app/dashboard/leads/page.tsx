import { listLeads } from "@/lib/actions/leads";
import LeadsHeader from "@/components/leads/LeadsHeader";
import AiFilterBuilder from "@/components/leads/AiFilterBuilder";
import LeadsTable from "@/components/leads/LeadsTable";

export const metadata = {
  title: "All Leads | LeadGennie",
};

export default async function LeadsPage() {
  const leads = await listLeads();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <LeadsHeader />

      <div className="space-y-6">
        <AiFilterBuilder />
        <LeadsTable leads={leads} />
      </div>
    </div>
  );
}
