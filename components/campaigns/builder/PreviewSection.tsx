"use client";

import { useEffect, useState, useTransition } from "react";
import { CircleNotch, PaperPlaneTilt, Warning } from "@phosphor-icons/react/ssr";
import { getCampaignPreview, getCampaignPreviewLeads, sendCampaignTest } from "@/lib/actions/campaign-builder";
import type { CampaignPreview } from "@/lib/domain/campaigns/preview";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Select } from "@/components/ui/Field";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import { Field, Notice, formatWhen } from "./ui";

/** Pick any lead → the exact emails they'll get, every step, with sender, footer and send time. */
export default function PreviewSection({ view, canEdit, nav }: { view: BuilderView; canEdit: boolean; nav: BuilderNav }) {
  const c = view.campaign;
  const [leads, setLeads] = useState<{ id: number; name: string; excluded: string | null }[] | null>(null);
  const [leadId, setLeadId] = useState<number | null>(null);
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, start] = useTransition();
  const [sending, startSend] = useTransition();
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    start(async () => {
      const res = await getCampaignPreviewLeads(c.id);
      if (!res.ok) return setError(res.error.message);
      setLeads(res.data);
      setLeadId((prev) => prev ?? res.data[0]?.id ?? null);
    });
  }, [c.id, view]);

  useEffect(() => {
    if (!leadId) return;
    start(async () => {
      const res = await getCampaignPreview(c.id, leadId);
      if (!res.ok) return setError(res.error.message);
      setError(null);
      setPreview(res.data);
    });
  }, [c.id, leadId, view]);

  const test = (order: number) =>
    startSend(async () => {
      setSent(null);
      const res = await sendCampaignTest(c.id, leadId, order);
      setSent(res.ok ? `Test of email ${order} sent to ${res.data.to}.` : res.error.message);
    });

  return (
    <>
      <StepBody title="Preview" description="Exactly what a lead will receive — same renderer, footer and schedule the sender uses.">
        {leads && leads.length === 0 ? (
          <Notice tone="info">Nobody in the audience yet — pick an audience first.</Notice>
        ) : (
          <Field label="Preview as" htmlFor="p-lead">
            <Select id="p-lead" value={leadId ?? ""} onChange={(e) => setLeadId(Number(e.target.value))} disabled={!leads}>
              {(leads ?? []).map((l) => <option key={l.id} value={l.id}>{l.name}{l.excluded ? ` — excluded: ${l.excluded}` : ""}</option>)}
            </Select>
          </Field>
        )}
        {error && <Notice tone="error">{error}</Notice>}
        {loading && !preview && <CircleNotch className="h-5 w-5 animate-spin text-neutral-400" weight="bold" />}
        {preview && (
          <>
            {preview.excludedBecause && <Notice tone="warn" title={`${preview.lead.name} won't receive this campaign`}>{preview.excludedBecause}.</Notice>}
            {preview.missingDraft && <Notice tone="warn" title="No approved personalised email">The template fallback is off, so this lead would block launch.</Notice>}
            {preview.steps.map((s) => (
              <Card key={s.order}>
                <div className="flex flex-wrap items-center gap-2 border-b border-neutral-100 px-4 py-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold tabular-nums text-white">{s.order}</span>
                  <Badge tone={s.source === "draft" ? "violet" : "neutral"}>{s.source === "draft" ? "Personalised" : s.source === "sent" ? "As sent" : "Template"}</Badge>
                  <span className="ml-auto text-xs tabular-nums text-neutral-500">
                    {s.sendAtIsEstimate ? "If launched now: " : s.status === "sent" ? "Sent " : "Scheduled "}{formatWhen(s.sendAt)}
                  </span>
                </div>
                <dl className="space-y-1 border-b border-neutral-100 px-4 py-2.5 text-[13px]">
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-neutral-400">From</dt><dd className="truncate text-neutral-800">{preview.from ?? "— pick a mailbox"}</dd></div>
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-neutral-400">To</dt><dd className="truncate text-neutral-800">{preview.lead.email ?? "no email address"}</dd></div>
                  <div className="flex gap-2"><dt className="w-14 shrink-0 text-neutral-400">Subject</dt><dd className="truncate font-medium text-neutral-900">{s.subject}</dd></div>
                </dl>
                <div className="space-y-3 px-4 py-3">
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-800">{s.body}</p>
                  <p className="whitespace-pre-wrap border-t border-dashed border-neutral-200 pt-2 text-xs text-neutral-400">{s.footer.trim()}</p>
                  {s.warnings.map((w) => <p key={w} className="flex items-start gap-1.5 text-xs text-amber-800"><Warning className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />{w}</p>)}
                  {canEdit && (
                    <Button variant="secondary" size="xs" onClick={() => test(s.order)} disabled={sending}>
                      {sending ? <CircleNotch className="h-3.5 w-3.5 animate-spin" weight="bold" /> : <PaperPlaneTilt className="h-3.5 w-3.5" weight="duotone" />} Send this to me
                    </Button>
                  )}
                </div>
              </Card>
            ))}
            {sent && <p role="status" className="text-[13px] text-neutral-700">{sent}</p>}
            <p className="text-xs text-neutral-400">Before launch, times are estimates for this lead alone; the real schedule spreads everyone across your send window and daily limit.</p>
          </>
        )}
      </StepBody>
      <BuilderFooter nav={nav} hint={preview ? `As ${preview.lead.name}` : undefined} />
    </>
  );
}
