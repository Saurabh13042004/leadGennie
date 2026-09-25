import Link from "next/link";
import { Megaphone } from "@phosphor-icons/react/ssr";
import PageHeader from "@/components/ui/PageHeader";
import { listWorkflows } from "@/lib/actions/workflows";
import { listAudienceOptions } from "@/lib/actions/campaigns";
import { getSenderProfile } from "@/lib/actions/profile";
import { listSendableMailboxes } from "@/lib/actions/mailboxes";
import { linkedinAutomationEnabled } from "@/lib/feature-flags";
import NewCampaignForm from "@/components/campaigns/builder/NewCampaignForm";
import StepBody from "@/components/campaigns/wizard/StepBody";
import CampaignWizard from "@/components/campaigns/wizard/CampaignWizard";

export const metadata = {
  title: "Create campaign | LeadGennie",
};

export default async function NewCampaignPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const { mode } = await searchParams;
  const multichannel = linkedinAutomationEnabled();

  // D-05: the multi-channel wizard (LinkedIn DM steps) exists only behind FEATURE_LINKEDIN_AUTOMATION.
  if (multichannel && mode === "multichannel") {
    const [audiences, profile, mailboxes, workflows] = await Promise.all([listAudienceOptions(), getSenderProfile(), listSendableMailboxes(), listWorkflows()]);
    return <CampaignWizard audiences={audiences} initialPitch={profile.pitch ?? ""} mailboxes={mailboxes} workflows={workflows} />;
  }

  const workflows = await listWorkflows();
  return (
    <>
      <PageHeader title="New campaign" icon={Megaphone} crumbs={[{ label: "Campaigns", href: "/dashboard/campaigns" }]} description="Email sequence builder" />
      <StepBody title="Name your campaign" description="Then build it step by step: audience, emails, personalization, preview, approval.">
        <NewCampaignForm workflows={workflows} />
        {multichannel && (
          <p className="text-xs text-neutral-500">
            Need LinkedIn DM steps? <Link href="/dashboard/campaigns/new?mode=multichannel" className="font-medium text-indigo-600 hover:text-indigo-800">Use the multi-channel wizard</Link> (LinkedIn automation is enabled for this deployment).
          </p>
        )}
      </StepBody>
    </>
  );
}
