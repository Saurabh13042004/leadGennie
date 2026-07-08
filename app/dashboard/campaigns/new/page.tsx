import { listAudienceOptions } from "@/lib/actions/campaigns";
import CampaignWizard from "@/components/campaigns/wizard/CampaignWizard";

export const metadata = {
  title: "Create campaign | LeadGennie",
};

export default async function NewCampaignPage() {
  const audiences = await listAudienceOptions();

  return <CampaignWizard audiences={audiences} />;
}
