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
      <div className="border-b border-neutral-200/80 bg-gradient-to-b from-violet-50/50 via-white to-white px-4 py-8 md:px-6">
        <div className="mx-auto max-w-3xl">
          <AiFilterBuilder />
        </div>
      </div>
      <AudienceList segments={segments} canManage={canManage} />
    </>
  );
}
