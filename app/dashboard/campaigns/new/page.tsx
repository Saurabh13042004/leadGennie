import { listAudienceOptions } from "@/lib/actions/campaigns";
import { getSenderProfile } from "@/lib/actions/profile";
import CampaignWizard from "@/components/campaigns/wizard/CampaignWizard";

export const metadata = {
  title: "Create campaign | LeadGennie",
};

export default async function NewCampaignPage() {
  const [audiences, profile] = await Promise.all([listAudienceOptions(), getSenderProfile()]);

  return <CampaignWizard audiences={audiences} initialPitch={profile.pitch ?? ""} />;
}
