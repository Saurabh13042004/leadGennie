import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { listCampaigns } from "@/lib/actions/campaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";

export const metadata = {
  title: "Launch Campaigns | LeadGennie",
};

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Campaigns</h1>
            <p className="text-sm text-neutral-500">Personalized multi-channel sequences — powered by AI.</p>
          </div>
        </div>

        <Link
          href="/dashboard/campaigns/new"
          className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 bg-[#0A0A0A] flex flex-col items-center justify-center text-center py-20 px-6">
          <p className="text-white font-medium">No campaigns yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Launch your first AI-personalized outbound sequence.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}
