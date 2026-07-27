import Link from "next/link";
import { Megaphone, Plus, CheckCircle2, ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { listCampaigns } from "@/lib/actions/campaigns";
import CampaignCard from "@/components/campaigns/CampaignCard";
import SendNowButton from "@/components/campaigns/SendNowButton";

export const metadata = {
  title: "Launch Campaigns | LeadGennie",
};

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ launched?: string; blocked?: string }>;
}) {
  const [session, campaigns, { launched, blocked }] = await Promise.all([
    auth(),
    listCampaigns(),
    searchParams,
  ]);
  const blockedCount = blocked ? Number(blocked) : 0;
  const canApprove = session?.user?.role === "owner" || session?.user?.role === "admin";

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

        <div className="flex items-start gap-2">
          {canApprove && <SendNowButton />}
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-2 bg-white text-black font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-neutral-200 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </Link>
        </div>
      </div>

      {launched && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm text-purple-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Submitted for approval — an owner or admin needs to review it before any send goes out.
        </div>
      )}
      {blockedCount > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {blockedCount} lead{blockedCount === 1 ? " was" : "s were"} excluded from this campaign by compliance
            rules (Do Not Contact or recent-contact cooldown). See{" "}
            <Link href="/dashboard/do-not-contact" className="underline hover:text-yellow-100">
              Do Not Contact
            </Link>{" "}
            for details.
          </span>
        </div>
      )}

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
            <CampaignCard key={c.id} campaign={c} canApprove={canApprove} />
          ))}
        </div>
      )}
    </div>
  );
}
