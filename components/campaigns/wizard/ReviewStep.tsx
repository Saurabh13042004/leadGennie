"use client";

import Link from "next/link";
import { CircleNotch, EnvelopeSimple, LinkedinLogo, RocketLaunch, ShieldCheck, WarningCircle } from "@phosphor-icons/react/ssr";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { Input, Label, Select } from "@/components/ui/Field";
import StepBody from "./StepBody";
import WizardFooter from "./WizardFooter";
import type { CampaignDraft } from "./useCampaignDraft";

export default function ReviewStep({ draft }: { draft: CampaignDraft }) {
  const {
    name,
    audience,
    channels,
    steps,
    totalDays,
    dailyEmailLimit,
    setDailyEmailLimit,
    dailyDmLimit,
    setDailyDmLimit,
    mailboxes,
    mailboxId,
    setMailboxId,
    error,
    launching,
    launch,
    setStep,
  } = draft;

  if (!audience) return null;

  const summary: [string, string][] = [
    ["Name", name || audience.name],
    ["Audience", `${audience.name} (${audience.leadCount.toLocaleString()})`],
    ["Channels", channels],
    ["Steps", `${steps.length} touchpoints over ${totalDays} days`],
    ["Daily limit", `${dailyEmailLimit} emails / ${dailyDmLimit} DMs`],
  ];

  return (
    <>
      <StepBody title="Review and submit" description="Double-check the audience, sequence and sending limits.">
        <div className="flex items-start gap-3 rounded-xl bg-indigo-50/60 px-4 py-3 ring-1 ring-inset ring-indigo-200/70">
          <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-indigo-600" weight="fill" />
          <div>
            <h3 className="text-[13px] font-semibold text-neutral-900">Ready to submit for approval</h3>
            <p className="mt-0.5 text-xs text-neutral-600">
              An owner or admin will review the audience and a sample message before anything sends.
            </p>
          </div>
        </div>

        <Section title="Summary" description="What this campaign will do once approved.">
          <dl className="divide-y divide-neutral-100 rounded-lg ring-1 ring-inset ring-neutral-200/80">
            {summary.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <dt className="text-[13px] text-neutral-500">{label}</dt>
                <dd className="truncate text-right text-[13px] font-medium text-neutral-900">{value}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Sequence" description="Touchpoints in send order.">
          <ol className="space-y-1.5">
            {steps.map((s, idx) => {
              const Icon = s.channel === "email" ? EnvelopeSimple : LinkedinLogo;
              const preview = (s.channel === "email" && s.subject?.trim()) || s.body.trim().split("\n")[0] || "No message yet";
              return (
                <li key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-inset ring-neutral-200/80">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold tabular-nums text-white">
                    {idx + 1}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-neutral-400" weight="duotone" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-800">{preview}</span>
                  <span className="shrink-0 text-xs tabular-nums text-neutral-400">
                    {idx === 0 ? "Immediately" : `+${s.waitDays}d`}
                  </span>
                </li>
              );
            })}
          </ol>
        </Section>

        <Section title="Sending" description="The mailbox messages go out from, and daily caps per channel.">
          <div className="space-y-4">
            <div>
              <Label htmlFor="review-mailbox">From mailbox</Label>
              {mailboxes.length === 0 ? (
                <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200/70">
                  <WarningCircle className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />
                  <span>
                    No active, verified mailbox yet.{" "}
                    <Link href="/dashboard/deliverability" className="font-medium underline underline-offset-2 hover:text-amber-900">
                      Add one in Email Deliverability
                    </Link>
                    .
                  </span>
                </p>
              ) : (
                <Select id="review-mailbox" value={mailboxId ?? ""} onChange={(e) => setMailboxId(Number(e.target.value))}>
                  {mailboxes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.email}
                    </option>
                  ))}
                </Select>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="review-email-limit">Emails/day</Label>
                <Input
                  id="review-email-limit"
                  type="number"
                  value={dailyEmailLimit}
                  onChange={(e) => setDailyEmailLimit(Number(e.target.value))}
                  className="tabular-nums"
                />
              </div>
              <div>
                <Label htmlFor="review-dm-limit">DMs/day</Label>
                <Input
                  id="review-dm-limit"
                  type="number"
                  value={dailyDmLimit}
                  onChange={(e) => setDailyDmLimit(Number(e.target.value))}
                  className="tabular-nums"
                />
              </div>
            </div>
          </div>
        </Section>

        {error && (
          <p className="flex items-center gap-1.5 text-[13px] text-rose-600">
            <WarningCircle className="h-4 w-4 shrink-0" weight="fill" />
            {error}
          </p>
        )}
      </StepBody>

      <WizardFooter step={3} onBack={() => setStep(2)} hint={`${audience.leadCount.toLocaleString()} leads`}>
        <Button variant="primary" onClick={launch} disabled={launching || !mailboxId}>
          {launching ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <RocketLaunch className="h-4 w-4" weight="duotone" />}
          Submit for approval
        </Button>
      </WizardFooter>
    </>
  );
}
