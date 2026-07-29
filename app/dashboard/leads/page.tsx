import { auth } from "@/auth";
import { listLeads } from "@/lib/actions/leads";
import LeadsHeader from "@/components/leads/LeadsHeader";
import LeadsTable from "@/components/leads/LeadsTable";

export const metadata = {
  title: "All Leads | LeadGennie",
};

export default async function LeadsPage() {
  const [session, leads] = await Promise.all([auth(), listLeads()]);
  const role = session?.user?.role;
  const canEdit = role !== "viewer";
  const canDelete = role === "owner" || role === "admin";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <LeadsHeader canEdit={canEdit} />

      <div className="space-y-6">
        <LeadsTable leads={leads} canEdit={canEdit} canDelete={canDelete} />
      </div>
    </div>
  );
}
