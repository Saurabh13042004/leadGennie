"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CircleNotch, ShieldCheck, WarningCircle } from "@phosphor-icons/react/ssr";
import { saveCampaignBasics } from "@/lib/actions/campaign-builder";
import type { Mailbox } from "@/lib/actions/mailboxes";
import { PROVIDER_LABEL } from "@/lib/domain/mailboxes/types";
import type { BuilderView } from "@/lib/domain/campaigns/views";
import { TONES, type Tone } from "@/lib/domain/personalization/types";
import { cn } from "@/lib/utils";
import { Section } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { Input, Select } from "@/components/ui/Field";
import StepBody from "@/components/campaigns/wizard/StepBody";
import BuilderFooter, { type BuilderNav } from "./BuilderFooter";
import { Field, SaveMessage } from "./ui";
import { useSave } from "./useSave";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COMMON_TZ = ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney"];
const subscribeNever = () => () => {};
const browserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
};
const hour = (h: number) => `${String(h % 24).padStart(2, "0")}:00`;

export default function BasicsSection({ view, mailboxes, editable, onSaved, nav }: { view: BuilderView; mailboxes: Mailbox[]; editable: boolean; onSaved: (v: BuilderView) => void; nav: BuilderNav }) {
  const c = view.campaign;
  const [name, setName] = useState(c.name);
  const [mailboxId, setMailboxId] = useState<number | null>(c.mailboxId ?? mailboxes[0]?.id ?? null);
  const [tone, setTone] = useState<Tone>(c.tone);
  const [dailyLimit, setDailyLimit] = useState(String(c.dailyLimit));
  const [totalLimit, setTotalLimit] = useState(c.totalLimit === null ? "" : String(c.totalLimit));
  const [days, setDays] = useState<number[]>(c.sendWindow.days);
  const [startHour, setStartHour] = useState(c.sendWindow.startHour);
  const [endHour, setEndHour] = useState(c.sendWindow.endHour);
  const [tzChoice, setTzChoice] = useState<string | null>(null);
  const [fallback, setFallback] = useState(c.allowTemplateFallback);
  const { pending, message, save } = useSave(onSaved);
  const mailbox = mailboxes.find((m) => m.id === mailboxId);

  // New campaigns start in UTC, which puts a 9–5 window in the middle of the night for most people. Until the timezone has been
  // saved as something else, offer the browser's (null on the server, so hydration matches). Only the form uses it; Save keeps it.
  const browserTz = useSyncExternalStore(subscribeNever, browserTimezone, () => null);
  const suggestedTz = editable && c.sendWindow.timezone === "UTC" && browserTz && browserTz !== "UTC" ? browserTz : null;
  const timezone = tzChoice ?? suggestedTz ?? c.sendWindow.timezone;
  const tzFromBrowser = tzChoice === null && suggestedTz !== null;

  const zones = COMMON_TZ.includes(timezone) ? COMMON_TZ : [timezone, ...COMMON_TZ];

  const submit = () =>
    save(() =>
      saveCampaignBasics(c.id, {
        name, mailboxId, tone, dailyLimit: Number(dailyLimit), totalLimit: totalLimit.trim() ? Number(totalLimit) : null,
        sendWindow: { days: [...days].sort(), startHour, endHour, timezone }, allowTemplateFallback: fallback,
      }),
    );

  return (
    <>
      <StepBody title="Basics" description="Who it comes from, how fast it goes out, and when.">
        <fieldset disabled={!editable || pending} className="space-y-5">
          <Section title="Campaign" description="The name only you see, and the voice for per-lead emails.">
            <div className="space-y-4">
              <Field label="Name" htmlFor="c-name"><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></Field>
              <Field label="Tone" htmlFor="c-tone" help="Used when Gennie writes each lead's personalised email.">
                <Select id="c-tone" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                  {TONES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Sending" description="The mailbox emails go out from, and how many per day.">
            <div className="space-y-4">
              <Field label="From mailbox" htmlFor="c-mailbox" help={c.mailboxId === null && mailboxes.length > 0 ? "Not saved yet — click Save to use this mailbox." : undefined}>
                {mailboxes.length === 0 ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-inset ring-amber-200/70">
                    <WarningCircle className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />
                    <span>No connected mailbox yet. <Link href="/dashboard/deliverability" className="font-medium underline underline-offset-2">Connect one under Mailboxes</Link>.</span>
                  </p>
                ) : (
                  <Select id="c-mailbox" value={mailboxId ?? ""} onChange={(e) => setMailboxId(Number(e.target.value))}>
                    {c.mailboxId !== null && !mailboxes.some((m) => m.id === c.mailboxId) && (
                      <option value={c.mailboxId} disabled>{view.readiness.mailbox?.email ?? "Saved mailbox"} — can&apos;t send right now</option>
                    )}
                    {mailboxes.map((m) => <option key={m.id} value={m.id}>{m.email} · {PROVIDER_LABEL[m.provider]} — up to {m.dailyLimit}/day</option>)}
                  </Select>
                )}
                {view.readiness.mailbox && !view.readiness.mailbox.active && view.readiness.mailbox.blockedReason && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-800">
                    <WarningCircle className="mt-px h-3.5 w-3.5 shrink-0" weight="fill" />
                    <span>{view.readiness.mailbox.email} can&apos;t send: {view.readiness.mailbox.blockedReason} <Link href="/dashboard/deliverability" className="font-medium underline underline-offset-2">Fix it under Mailboxes</Link> or pick another.</span>
                  </p>
                )}
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Emails per day" htmlFor="c-daily" hint={mailbox ? `max ${mailbox.dailyLimit}` : undefined}>
                  <Input id="c-daily" type="number" min={1} max={mailbox?.dailyLimit ?? 1000} value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} className="tabular-nums" />
                </Field>
                <Field label="Total leads" htmlFor="c-total" hint="optional">
                  <Input id="c-total" type="number" min={1} value={totalLimit} onChange={(e) => setTotalLimit(e.target.value)} placeholder="Whole audience" className="tabular-nums" />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Send window" description="Emails only go out on these days and hours, in this timezone.">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Sending days">
                {DAYS.map((d, i) => {
                  const on = days.includes(i);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => setDays((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))}
                      className={cn("inline-flex h-8 items-center rounded-lg px-3 text-[13px] ring-1 ring-inset transition-colors disabled:opacity-50", on ? "bg-indigo-50 text-indigo-800 ring-indigo-300" : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50 hover:ring-neutral-300")}>
                      {d}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="From" htmlFor="c-start"><Select id="c-start" value={startHour} onChange={(e) => setStartHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{hour(h)}</option>)}</Select></Field>
                <Field label="Until" htmlFor="c-end"><Select id="c-end" value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>{Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{hour(h)}{h === 24 ? " (midnight)" : ""}</option>)}</Select></Field>
                <Field label="Timezone" htmlFor="c-tz" help={tzFromBrowser ? "Set to this browser's timezone — click Save to keep it." : undefined}><Select id="c-tz" value={timezone} onChange={(e) => setTzChoice(e.target.value)}>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</Select></Field>
              </div>
            </div>
          </Section>

          <Section title="Safety" description="What always stops a lead, and what happens without a personalised email.">
            <div className="space-y-4">
              <p className="flex items-start gap-2 text-[13px] leading-relaxed text-neutral-600">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" weight="fill" />
                A lead stops receiving this sequence the moment they unsubscribe, hard-bounce, complain or are added to Do Not Contact — checked again right before every email.
              </p>
              <label className="flex items-start gap-2.5 text-[13px] text-neutral-700">
                <Checkbox checked={fallback} onChange={(e) => setFallback(e.target.checked)} className="mt-0.5" />
                <span><span className="font-medium text-neutral-900">Template fallback.</span> Leads without an approved personalised email get the step&apos;s template instead of blocking launch.</span>
              </label>
            </div>
          </Section>
        </fieldset>
      </StepBody>

      <BuilderFooter nav={nav} hint={mailbox ? `${mailbox.email} · ${dailyLimit}/day` : "No mailbox"}>
        <SaveMessage message={message} />
        {editable && (
          <Button variant="primary" onClick={submit} disabled={pending}>
            {pending && <CircleNotch className="h-4 w-4 animate-spin" weight="bold" />} Save
          </Button>
        )}
      </BuilderFooter>
    </>
  );
}
