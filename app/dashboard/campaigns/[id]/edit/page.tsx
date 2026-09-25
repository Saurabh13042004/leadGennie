import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getBuilderView } from "@/lib/actions/campaign-builder";
import { listSendableMailboxes } from "@/lib/actions/mailboxes";
import { listSegments } from "@/lib/actions/campaigns";
import CampaignBuilder from "@/components/campaigns/builder/CampaignBuilder";
import { AppError } from "@/lib/api/errors";

export const metadata = {
  title: "Campaign builder | LeadGennie",
};

export default async function CampaignEditPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  const view = await getBuilderView(id).catch((e) => {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  });
  // Campaigns made with the old wizard have no builder; their page still offers pause/resume/cancel.
  if (view.campaign.sendModel !== "leads") redirect(`/dashboard/campaigns/${id}`);
  const [session, mailboxes, segments] = await Promise.all([auth(), listSendableMailboxes(), listSegments()]);
  const canEdit = session?.user?.role !== "viewer";
  return <CampaignBuilder initial={view} mailboxes={mailboxes} segments={segments.map((s) => ({ id: s.id, name: s.name }))} canEdit={canEdit} />;
}
