"use client";

import { useState } from "react";
import { Megaphone } from "@phosphor-icons/react/ssr";
import PageHeader from "@/components/ui/PageHeader";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import { isStructureEditable } from "@/lib/domain/campaigns/state-machine";
import type { Mailbox } from "@/lib/actions/mailboxes";
import BuilderStepper, { type BuilderStepKey } from "./BuilderStepper";
import type { BuilderNav } from "./BuilderFooter";
import BasicsSection from "./BasicsSection";
import AudienceSection from "./AudienceSection";
import SequenceSection from "./SequenceSection";
import PersonalizationSection from "./PersonalizationSection";
import PreviewSection from "./PreviewSection";
import ReviewSection from "./ReviewSection";
import ChecklistPanel from "./ChecklistPanel";
import { Notice, StatusBadge } from "./ui";

export type SegmentOption = { id: number; name: string };

/**
 * The campaign builder — same anatomy as the dashboard's other builders: a left rail (steps + live recap), a centred
 * step body, and a sticky footer. Every save returns the fresh readiness checklist.
 */
export default function CampaignBuilder({ initial, mailboxes, segments, canEdit }: { initial: BuilderView; mailboxes: Mailbox[]; segments: SegmentOption[]; canEdit: boolean }) {
  const [view, setView] = useState(initial);
  const [step, setStep] = useState<BuilderStepKey>("basics");
  const c = view.campaign;
  const editable = canEdit && isStructureEditable(c.status);
  const blocked = new Set(view.readiness.blockers.map((b) => b.section));
  const nav: BuilderNav = { step, go: setStep };

  const lockNote =
    c.status === "draft" || c.status === "rejected"
      ? null
      : c.status === "pending_approval"
        ? "Waiting for an owner or admin to approve. Settings are locked so the approver reviews exactly what will send."
        : c.status === "ready" || c.status === "running" || c.status === "paused"
          ? "Settings and audience are locked after approval. You can still edit the copy of emails that haven't gone out (Sequence)."
          : "This campaign can't be edited any more.";

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Builder"
        icon={Megaphone}
        crumbs={[{ label: "Campaigns", href: "/dashboard/campaigns" }, { label: c.name, href: `/dashboard/campaigns/${c.id}` }]}
        actions={<StatusBadge status={c.status} />}
      />

      <div className="flex flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-neutral-200/80 bg-neutral-50/50 px-4 py-3 md:px-6 lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="lg:sticky lg:top-20">
            <BuilderStepper current={step} blocked={blocked} onSelect={setStep} />
            <ChecklistPanel readiness={view.readiness} onGoTo={(s) => setStep(s)} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {lockNote && (
            <div className="px-4 pt-6 md:px-8">
              <div className="mx-auto max-w-3xl">
                <Notice tone="info">{lockNote}</Notice>
              </div>
            </div>
          )}
          {step === "basics" && <BasicsSection view={view} mailboxes={mailboxes} editable={editable} onSaved={setView} nav={nav} />}
          {step === "audience" && <AudienceSection view={view} segments={segments} editable={editable} onSaved={setView} nav={nav} />}
          {step === "sequence" && <SequenceSection view={view} canEdit={canEdit} onSaved={setView} nav={nav} />}
          {step === "personalization" && <PersonalizationSection view={view} editable={editable} onSaved={setView} nav={nav} />}
          {step === "preview" && <PreviewSection view={view} canEdit={canEdit} nav={nav} />}
          {step === "review" && <ReviewSection view={view} canEdit={canEdit} nav={nav} />}
        </div>
      </div>
    </div>
  );
}
