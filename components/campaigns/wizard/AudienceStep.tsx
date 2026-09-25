"use client";

import Link from "next/link";
import { ArrowRight, CircleNotch, FlowArrow, UsersThree, Warning } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Help, Input, Label, Textarea } from "@/components/ui/Field";
import StepBody from "./StepBody";
import WizardFooter from "./WizardFooter";
import type { CampaignDraft } from "./useCampaignDraft";

export default function AudienceStep({ draft }: { draft: CampaignDraft }) {
  const {
    workflows,
    workflowId,
    workflowLoading,
    applyWorkflow,
    clearWorkflow,
    name,
    setName,
    audience,
    audiences,
    audienceIdx,
    setAudienceIdx,
    pitch,
    setPitch,
    savingPitch,
    continueFromAudience,
  } = draft;

  return (
    <>
      <StepBody title="Who are you reaching?" description="Name the campaign, ground the AI in your pitch, and pick a segment to send to.">
        {workflows.length > 0 && (
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-1.5">
                  <FlowArrow className="h-4 w-4 text-indigo-600" weight="duotone" />
                  Start from a saved workflow
                </span>
              }
              description="Pre-fills the audience and sequence below from a workflow built in Agentic Flows — still fully editable after."
              action={
                workflowId !== null && (
                  <Button variant="ghost" size="xs" onClick={clearWorkflow} disabled={workflowLoading}>
                    Clear
                  </Button>
                )
              }
            />
            <div className="flex flex-wrap gap-2 p-4">
              {workflows.map((w) => {
                const on = workflowId === w.id;
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => applyWorkflow(w.id)}
                    disabled={workflowLoading}
                    className={cn(
                      "inline-flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] ring-1 ring-inset transition-colors disabled:opacity-50",
                      on ? "bg-indigo-50 text-indigo-800 ring-indigo-300" : "bg-white text-neutral-700 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
                    )}
                  >
                    {w.name}
                    <span className={cn("text-xs tabular-nums", on ? "text-indigo-500" : "text-neutral-400")}>
                      {w.stepCount} step{w.stepCount === 1 ? "" : "s"}
                    </span>
                  </button>
                );
              })}
              {workflowLoading && <CircleNotch className="h-4 w-4 self-center animate-spin text-neutral-400" weight="bold" />}
            </div>
          </Card>
        )}

        <Card className="space-y-5 p-5">
          <div>
            <Label htmlFor="campaign-name" hint="Optional — defaults to the audience name">
              Campaign name
            </Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={audience?.name ?? "e.g. Q3 outreach to SaaS founders"}
            />
          </div>
          <div>
            <Label htmlFor="campaign-pitch" hint="Saved to your profile">
              What do you sell, and why should this audience care?
            </Label>
            <Textarea
              id="campaign-pitch"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              rows={3}
              placeholder="e.g. We build an AI code-review tool for engineering teams. Cuts PR review time in half and catches bugs before they hit prod. Best for eng teams 20-200 people shipping fast."
              className="resize-none"
            />
            <Help>
              This grounds every AI-written message in your actual pitch instead of generic filler. Saved to your profile and reused
              across campaigns.
            </Help>
            {!pitch.trim() && (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
                <Warning className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />
                Leave this empty and the AI will avoid inventing fake product claims — but the copy will be generic.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Choose your audience" description="Pick a saved segment or build a new one with AI." />
          {audiences.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-neutral-500">
              No segments yet.{" "}
              <Link href="/dashboard/leads" className="font-medium text-indigo-600 hover:text-indigo-700">
                Build one from the Leads page
              </Link>
              .
            </p>
          ) : (
            <div role="radiogroup" aria-label="Audience" className="grid gap-2 p-4 sm:grid-cols-2">
              {audiences.map((a, i) => {
                const on = audienceIdx === i;
                return (
                  <button
                    key={`${a.id}-${a.name}`}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAudienceIdx(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-3 text-left ring-1 ring-inset transition-all",
                      on
                        ? "bg-indigo-50/60 ring-2 ring-indigo-500/70"
                        : "bg-white ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                        on ? "bg-white text-indigo-600 ring-indigo-200" : "bg-neutral-50 text-neutral-500 ring-neutral-200/80",
                      )}
                    >
                      <UsersThree className="h-4 w-4" weight="duotone" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-neutral-900">{a.name}</span>
                      <span className="block truncate text-xs text-neutral-500">
                        <span className="tabular-nums">{a.leadCount.toLocaleString()}</span> leads · {a.updatedLabel}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                        on ? "bg-indigo-600 ring-indigo-600" : "bg-white ring-neutral-300",
                      )}
                    >
                      {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      </StepBody>

      <WizardFooter step={1} hint={audience ? `${audience.name} · ${audience.leadCount.toLocaleString()} leads` : "No audience selected"}>
        <Button variant="primary" onClick={continueFromAudience} disabled={!audience || savingPitch}>
          {savingPitch && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />}
          Continue
          <ArrowRight className="h-4 w-4" weight="bold" />
        </Button>
      </WizardFooter>
    </>
  );
}
