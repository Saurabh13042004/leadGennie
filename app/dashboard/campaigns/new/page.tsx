import { listAudienceOptions } from "@/lib/actions/campaigns";
import { getSenderProfile } from "@/lib/actions/profile";
import { listSendableMailboxes } from "@/lib/actions/mailboxes";
import { listWorkflows } from "@/lib/actions/workflows";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
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
      // D-05: email-only unless LinkedIn automation is enabled for this deployment.
      multichannel={linkedinAutomationEnabled()}
    />
  );
}
