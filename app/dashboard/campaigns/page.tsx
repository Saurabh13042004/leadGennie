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
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">Campaigns</h1>
            <p className="text-sm text-neutral-500">Personalized multi-channel sequences — powered by AI.</p>
          </div>
        </div>

        <div className="flex items-start gap-2">
          {canApprove && <SendNowButton />}
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </Link>
        </div>
      </div>

      {launched && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Submitted for approval — an owner or admin needs to review it before any send goes out.
        </div>
      )}
      {blockedCount > 0 && (
        <div className="mb-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {blockedCount} lead{blockedCount === 1 ? " was" : "s were"} excluded from this campaign by compliance
            rules (Do Not Contact or recent-contact cooldown). See{" "}
            <Link href="/dashboard/do-not-contact" className="underline hover:text-amber-900">
              Do Not Contact
            </Link>{" "}
            for details.
          </span>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/60 flex flex-col items-center justify-center text-center py-20 px-6">
          <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center mb-4">
            <Megaphone className="w-7 h-7 text-indigo-500" />
          </div>
          <p className="text-neutral-900 font-semibold">No campaigns yet</p>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            Launch your first AI-personalized outbound sequence.
          </p>
          <Link
            href="/dashboard/campaigns/new"
            className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors mt-6"
          >
            <Plus className="w-4 h-4" />
            New campaign
          </Link>
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
