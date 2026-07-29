import { List } from "lucide-react";
import { auth } from "@/auth";
import { listSegments } from "@/lib/actions/leads";
import AiFilterBuilder from "@/components/leads/AiFilterBuilder";
import AudienceList from "@/components/leads/AudienceList";

export const metadata = {
  title: "Audience | LeadGennie",
};

export default async function AudiencePage() {
  const [session, segments] = await Promise.all([auth(), listSegments()]);
  const canManage = session?.user?.role !== "viewer";

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
          <List className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Audience</h1>
          <p className="text-sm text-neutral-500">Build and manage saved audiences from your lead universe.</p>
        </div>
      </div>

      <div className="space-y-6">
        <AiFilterBuilder />
        <AudienceList segments={segments} canManage={canManage} />
      </div>
    </div>
  );
}
