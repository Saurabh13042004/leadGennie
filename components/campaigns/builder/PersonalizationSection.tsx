"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle, Checks, CircleNotch, EnvelopeSimpleOpen, PencilSimpleLine, Sparkle, WarningOctagon } from "@phosphor-icons/react/ssr";
import { approveCampaignDrafts, generateCampaignDrafts, getBuilderView } from "@/lib/actions/campaign-builder";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import Card, { CardHeader } from "@/components/ui/Card";
import Button, { buttonClasses } from "@/components/ui/Button";
import Stat from "@/components/ui/Stat";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ResearchProgress from "@/components/leads/ResearchProgress";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import { Notice } from "./ui";

const REASON = { missing: { label: "No draft yet", tone: "neutral" }, needs_review: { label: "To review", tone: "indigo" }, failed_validation: { label: "Failed checks", tone: "rose" } } as const;

/**
 * Per-lead emails come from Phase 3: written as background jobs, checked by the validators, approved one by one (or all
 * clean ones at once). Anything not approved blocks launch unless the template fallback is on.
 */
export default function PersonalizationSection({ view, editable, onSaved, nav }: { view: BuilderView; editable: boolean; onSaved: (v: BuilderView) => void; nav: BuilderNav }) {
  const c = view.campaign;
  const d = view.readiness.drafts;
  const [runId, setRunId] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const reload = async () => onSaved(await getBuilderView(c.id));

  const generate = () =>
    start(async () => {
      setMessage(null);
      const res = await generateCampaignDrafts(c.id);
      if (!res.ok) return setMessage({ ok: false, text: res.error.message });
      setRunId(res.data.agentRunId);
      setMessage({ ok: true, text: `Writing ${res.data.enqueued.length} email(s)…${res.data.remaining > 0 ? ` ${res.data.remaining} more after this batch.` : ""}` });
    });
  const approveAll = () =>
    start(async () => {
      setMessage(null);
      const res = await approveCampaignDrafts(c.id);
      if (!res.ok) return setMessage({ ok: false, text: res.error.message });
      await reload();
      setMessage({ ok: true, text: `Approved ${res.data.approved} email(s).${res.data.refused.length ? ` ${res.data.refused.length} no longer pass the checks — open them to fix.` : ""}` });
    });

  return (
    <>
      <StepBody title="Personalization" description="Each lead's first email, written from their verified research and checked before anyone can approve it.">
        {!d.personalized ? (
          <Card>
            <EmptyState compact icon={EnvelopeSimpleOpen} title="Everyone gets the same first email"
              description="To send each lead their own evidence-backed email, choose “Personalised per lead” on the first email in the Sequence step. Follow-ups always use templates."
              actions={<Button variant="secondary" onClick={() => nav.go("sequence")}>Go to Sequence</Button>} />
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Approved" value={d.approved} icon={CheckCircle} tone="emerald" />
              <Stat label="To review" value={d.needsReview} icon={PencilSimpleLine} tone="indigo" />
              <Stat label="Failed checks" value={d.failed} icon={WarningOctagon} tone="rose" />
              <Stat label="Not written" value={d.missing} icon={EnvelopeSimpleOpen} tone="neutral" />
            </div>
            {c.allowTemplateFallback && (d.missing + d.needsReview + d.failed > 0) && (
              <Notice tone="info">Template fallback is on: leads without an approved email get the first step&apos;s template.</Notice>
            )}
            {editable && (
              <Card>
                <CardHeader title="Write and approve" description="Writing uses your OpenAI quota — about one or two model calls per lead." />
                <div className="flex flex-wrap items-center gap-2 p-4">
                  <Button variant="accent" onClick={generate} disabled={pending || d.missing === 0}>
                    {pending ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <Sparkle className="h-4 w-4" weight="fill" />} Write missing emails
                  </Button>
                  <Button variant="secondary" onClick={approveAll} disabled={pending || d.needsReview === 0}>
                    <Checks className="h-4 w-4" weight="bold" /> Approve all that passed
                  </Button>
                  <Link href="/dashboard/leads/drafts?status=needs_review" className={buttonClasses({ variant: "ghost" })}>Open review queue</Link>
                </div>
                {(runId !== null || message) && (
                  <div className="space-y-2 border-t border-neutral-100 px-4 py-3">
                    {runId !== null && <ResearchProgress agentRunId={runId} kind="drafts" onFinished={() => void reload()} />}
                    {message && <p role="status" className={message.ok ? "text-[13px] text-emerald-700" : "text-[13px] text-rose-600"}>{message.text}</p>}
                  </div>
                )}
              </Card>
            )}
            {d.blockingLeads.length > 0 && (
              <Card>
                <CardHeader title="Blocking launch" description="Open a lead to write, fix or approve their email." />
                <ul className="divide-y divide-neutral-100">
                  {d.blockingLeads.map((l) => (
                    <li key={l.id}>
                      <Link href={`/dashboard/leads/${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors hover:bg-neutral-50/80">
                        <Avatar name={l.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium text-neutral-900">{l.name}</span>
                        <Badge tone={REASON[l.reason].tone} dot>{REASON[l.reason].label}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </StepBody>
      <BuilderFooter nav={nav} hint={d.personalized ? `${d.approved} approved` : "Template mode"} />
    </>
  );
}
