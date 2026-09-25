import Link from "next/link";
import { CheckCircle, Megaphone, Plus, ShieldWarning } from "@phosphor-icons/react/ssr";
import { auth } from "@/auth";
import { listCampaigns } from "@/lib/actions/campaigns";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/Button";
import CampaignList from "@/components/campaigns/CampaignList";
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

  const newCampaign = (
    <Link href="/dashboard/campaigns/new" className={buttonClasses({ variant: "primary" })}>
      <Plus className="h-4 w-4" weight="bold" />
      New campaign
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Campaigns"
        icon={Megaphone}
        count={campaigns.length}
        description="Personalized multi-channel sequences"
        actions={
          <>
            {canApprove && <SendNowButton />}
            {newCampaign}
          </>
        }
      />

      {launched && (
        <div className="flex items-center gap-2 border-b border-indigo-100 bg-indigo-50/60 px-4 py-2.5 text-[13px] text-indigo-800 md:px-6">
          <CheckCircle className="h-4 w-4 shrink-0 text-indigo-600" weight="fill" />
          Submitted for approval — an owner or admin needs to review it before any send goes out.
        </div>
      )}
      {blockedCount > 0 && (
        <div className="flex items-start gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 text-[13px] text-amber-800 md:px-6">
          <ShieldWarning className="mt-px h-4 w-4 shrink-0 text-amber-600" weight="fill" />
          <span>
            {blockedCount} lead{blockedCount === 1 ? " was" : "s were"} excluded from this campaign by compliance
            rules (Do Not Contact or recent-contact cooldown). See{" "}
            <Link href="/dashboard/do-not-contact" className="font-medium underline underline-offset-2 hover:text-amber-900">
              Do Not Contact
            </Link>{" "}
            for details.
          </span>
        </div>
      )}

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          description="Launch your first AI-personalized outbound sequence. Nothing sends until an owner or admin approves it."
          actions={newCampaign}
        />
      ) : (
        <CampaignList campaigns={campaigns} canApprove={canApprove} />
      )}
    </>
  );
}
