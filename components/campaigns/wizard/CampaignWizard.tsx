"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import WizardStepper from "./WizardStepper";
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
}: {
  audiences: AudienceOption[];
  initialPitch: string;
  mailboxes: Mailbox[];
  workflows: WorkflowSummary[];
}) {
  const draft = useCampaignDraft({ audiences, initialPitch, mailboxes, workflows });

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto">
      <Link
        href="/dashboard/campaigns"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </Link>

      <h1 className="text-xl font-semibold text-white mb-1">Create campaign</h1>
      <p className="text-sm text-neutral-500 mb-6">Multi-channel sequence builder</p>

      <WizardStepper current={draft.step} />

      {draft.step === 1 && <AudienceStep draft={draft} />}
      {draft.step === 2 && <SequenceEditor draft={draft} />}
      {draft.step === 3 && <ReviewStep draft={draft} />}
    </div>
  );
}
