import { listAudienceOptions } from "@/lib/actions/campaigns";
import { getSenderProfile } from "@/lib/actions/profile";
import { listSendableMailboxes } from "@/lib/actions/mailboxes";
import { listWorkflows } from "@/lib/actions/workflows";
import CampaignWizard from "@/components/campaigns/wizard/CampaignWizard";

export const metadata = {
  title: "Create campaign | LeadGennie",
};

export default async function NewCampaignPage() {
  const [audiences, profile, mailboxes, workflows] = await Promise.all([
    listAudienceOptions(),
    getSenderProfile(),
    listSendableMailboxes(),
    listWorkflows(),
  ]);

  return (
    <CampaignWizard
      audiences={audiences}
      initialPitch={profile.pitch ?? ""}
      mailboxes={mailboxes}
      workflows={workflows}
    />
  );
}
