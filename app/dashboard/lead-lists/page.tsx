import { auth } from "@/auth";
import { listSegments } from "@/lib/actions/leads";
import AiFilterBuilder from "@/components/leads/AiFilterBuilder";
import AudienceList from "@/components/leads/AudienceList";
import LeadsPageHeader from "@/components/leads/LeadsPageHeader";

export const metadata = {
  title: "Audience | LeadGennie",
};

export default async function AudiencePage() {
  const [session, segments] = await Promise.all([auth(), listSegments()]);
  const canManage = session?.user?.role !== "viewer";

  return (
    <>
      <LeadsPageHeader description="Saved audiences, built in plain English" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-6">
        <AiFilterBuilder />
        <AudienceList segments={segments} canManage={canManage} />
      </div>
    </>
  );
}
