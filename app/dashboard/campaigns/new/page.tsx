import { listAudienceOptions } from "@/lib/actions/campaigns";
import { getSenderProfile } from "@/lib/actions/profile";
import { listSendableMailboxes } from "@/lib/actions/mailboxes";
import CampaignWizard from "@/components/campaigns/wizard/CampaignWizard";

export const metadata = {
  title: "Create campaign | LeadGennie",
};

export default async function NewCampaignPage() {
  const [audiences, profile, mailboxes] = await Promise.all([
    listAudienceOptions(),
    getSenderProfile(),
    listSendableMailboxes(),
  ]);

  return <CampaignWizard audiences={audiences} initialPitch={profile.pitch ?? ""} mailboxes={mailboxes} />;
}
