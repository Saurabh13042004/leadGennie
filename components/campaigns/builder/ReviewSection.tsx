"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleNotch, EnvelopeSimple, PaperPlaneTilt, ShieldCheck, WarningCircle } from "@phosphor-icons/react/ssr";
import { submitCampaign } from "@/lib/actions/campaign-builder";
import { EXCLUSION_LABEL, EXCLUSION_REASONS } from "@/lib/domain/campaigns/types";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import { Notice } from "./ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** 24 is the end of the day, not midnight at the start of it. */
const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

/** What the approver will see, then Submit for approval. */
export default function ReviewSection({ view, canEdit, nav }: { view: BuilderView; canEdit: boolean; nav: BuilderNav }) {
  const router = useRouter();
  const { campaign: c, readiness: r } = view;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const excluded = EXCLUSION_REASONS.filter((x) => r.audience.exclusions[x] > 0);
  const w = c.sendWindow;
  const canSubmit = canEdit && (c.status === "draft" || c.status === "rejected");
  const summary: [string, string][] = [
    ["From", r.mailbox?.email ?? "— not set"],
    ["Audience", `${r.willEnroll.toLocaleString()} lead(s)${r.overTotalLimit ? ` (+${r.overTotalLimit} over the total limit)` : ""}`],
    ["Limits", `${c.dailyLimit}/day${c.totalLimit ? ` · ${c.totalLimit} leads max` : ""}`],
    ["Send window", `${w.days.map((d) => DAYS[d]).join(", ")} · ${hh(w.startHour)}–${hh(w.endHour)} ${w.timezone}`],
  ];

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await submitCampaign(c.id);
      if (!res.ok) return setError(res.error.message);
      router.push(`/dashboard/campaigns/${c.id}`);
      router.refresh();
    });

  return (
    <>
      <StepBody title="Review and submit" description="Double-check who gets what, and when. Approval doesn't send anything — launching is a separate click.">
        {r.blockers.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl bg-indigo-50/60 px-4 py-3 ring-1 ring-inset ring-indigo-200/70">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0 text-indigo-600" weight="fill" />
            <div>
              <h3 className="text-[13px] font-semibold text-neutral-900">{canSubmit ? "Ready to submit for approval" : "Already submitted"}</h3>
              <p className="mt-0.5 text-xs text-neutral-600">An owner or admin reviews the audience and a sample email. You can approve your own if you&apos;re one.</p>
            </div>
          </div>
        ) : (
          <Notice tone="error" title={`Fix ${r.blockers.length} thing(s) first`}>
            <button type="button" onClick={() => nav.go(r.blockers[0].section)} className="text-left underline underline-offset-2">{r.blockers[0].message}</button>
          </Notice>
        )}

        <Section title="Summary" description="What this campaign will do once approved and launched.">
          <dl className="divide-y divide-neutral-100 rounded-lg ring-1 ring-inset ring-neutral-200/80">
            {summary.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
                <dt className="text-[13px] text-neutral-500">{k}</dt>
                <dd className="truncate text-right text-[13px] font-medium text-neutral-900">{v}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="Sequence" description="Emails in send order. Follow-ups reply in the same thread.">
          <ol className="space-y-1.5">
            {c.steps.map((s, idx) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg px-3 py-2 ring-1 ring-inset ring-neutral-200/80">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-[10px] font-semibold tabular-nums text-white">{idx + 1}</span>
                <EnvelopeSimple className="h-4 w-4 shrink-0 text-neutral-400" weight="duotone" />
                <span className="min-w-0 flex-1 truncate text-[13px] text-neutral-800">
                  {idx === 0 && s.mode === "personalized" ? "Personalised per lead" : (idx === 0 && s.subject.trim()) || s.body.trim().split("\n")[0] || "No message yet"}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-400">{idx === 0 ? "Day 0" : `+${s.waitDays}d`}</span>
              </li>
            ))}
          </ol>
        </Section>

        {excluded.length > 0 && (
          <Section title="Excluded" description="Counted and shown to the approver — never silently dropped.">
            <dl className="divide-y divide-neutral-100 rounded-lg ring-1 ring-inset ring-neutral-200/80">
              {excluded.map((x) => (
                <div key={x} className="flex justify-between gap-4 px-3.5 py-2.5 text-[13px]"><dt className="text-neutral-600">{EXCLUSION_LABEL[x]}</dt><dd className="font-medium tabular-nums text-neutral-900">{r.audience.exclusions[x]}</dd></div>
              ))}
            </dl>
          </Section>
        )}

        {r.warnings.length > 0 && <Notice tone="warn">{r.warnings.length} warning(s) in the checklist — they won&apos;t stop the launch.</Notice>}
        {error && <p className="flex items-center gap-1.5 text-[13px] text-rose-600"><WarningCircle className="h-4 w-4 shrink-0" weight="fill" />{error}</p>}
      </StepBody>

      <BuilderFooter nav={nav} hint={`${r.willEnroll.toLocaleString()} leads · ${c.steps.length} emails`}>
        {canSubmit && (
          <Button variant="primary" onClick={submit} disabled={pending || r.blockers.length > 0}>
            {pending ? <CircleNotch className="h-4 w-4 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-4 w-4" weight="fill" />} Submit for approval
          </Button>
        )}
      </BuilderFooter>
    </>
  );
}
