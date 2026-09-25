"use client";

import { Megaphone } from "@phosphor-icons/react/ssr";
import PageHeader from "@/components/ui/PageHeader";
import WizardStepper from "./WizardStepper";
import DraftSummary from "./DraftSummary";
import AudienceStep from "./AudienceStep";
import SequenceEditor from "./SequenceEditor";
import ReviewStep from "./ReviewStep";
import { useCampaignDraft } from "./useCampaignDraft";
import type { AudienceOption } from "@/lib/actions/campaigns";
import type { Mailbox } from "@/lib/actions/mailboxes";
import type { WorkflowSummary } from "@/lib/actions/workflows";

export default function CampaignWizard({
  audiences,
  initialPitch,
  mailboxes,
  workflows,
  multichannel = false,
}: {
  audiences: AudienceOption[];
  initialPitch: string;
  mailboxes: Mailbox[];
  workflows: WorkflowSummary[];
  multichannel?: boolean;
}) {
  const draft = useCampaignDraft({ audiences, initialPitch, mailboxes, workflows, multichannel });

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="New campaign"
        icon={Megaphone}
        crumbs={[{ label: "Campaigns", href: "/dashboard/campaigns" }]}
        description={multichannel ? "Multi-channel sequence builder" : "Email sequence builder"}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-neutral-200/80 bg-neutral-50/50 px-4 py-3 md:px-6 lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="lg:sticky lg:top-20">
            <WizardStepper current={draft.step} />
            <DraftSummary draft={draft} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {draft.step === 1 && <AudienceStep draft={draft} />}
          {draft.step === 2 && <SequenceEditor draft={draft} />}
          {draft.step === 3 && <ReviewStep draft={draft} />}
        </div>
      </div>
    </div>
  );
}
