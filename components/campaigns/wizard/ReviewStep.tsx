"use client";

import Link from "next/link";
import { Loader2, Rocket, ShieldCheck } from "lucide-react";
import type { CampaignDraft } from "./useCampaignDraft";

export default function ReviewStep({ draft }: { draft: CampaignDraft }) {
  const {
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

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 flex items-start gap-2.5">
        <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Ready to submit for approval</h3>
          <p className="text-xs text-neutral-600 mt-0.5">
            An owner or admin will review the audience and a sample message before anything sends.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white divide-y divide-neutral-100">
        {[
          ["Audience", `${audience.name} (${audience.leadCount.toLocaleString()})`],
          ["Channels", channels],
          ["Steps", `${steps.length} touchpoints over ${totalDays} days`],
          ["Daily limit", `${dailyEmailLimit} emails / ${dailyDmLimit} DMs`],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-neutral-500">{label}</span>
            <span className="text-sm font-medium text-neutral-900 text-right">{value}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1.5">From mailbox</label>
          {mailboxes.length === 0 ? (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No active, verified mailbox yet.{" "}
              <Link href="/dashboard/deliverability" className="underline hover:text-amber-900">
                Add one in Email Deliverability
              </Link>
              .
            </p>
          ) : (
            <select
              value={mailboxId ?? ""}
              onChange={(e) => setMailboxId(Number(e.target.value))}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg text-sm text-neutral-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              {mailboxes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.email}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">Emails/day</label>
            <input
              type="number"
              value={dailyEmailLimit}
              onChange={(e) => setDailyEmailLimit(Number(e.target.value))}
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-neutral-500 mb-1.5">DMs/day</label>
            <input
              type="number"
              value={dailyDmLimit}
              onChange={(e) => setDailyDmLimit(Number(e.target.value))}
              className="w-full rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex justify-between pt-1">
        <button
          onClick={() => setStep(2)}
          className="text-sm text-neutral-600 hover:text-neutral-900 border border-neutral-200 bg-white hover:bg-neutral-50 rounded-xl px-4 py-2.5 transition-colors"
        >
          Back
        </button>
        <button
          onClick={launch}
          disabled={launching || !mailboxId}
          className="flex items-center gap-2 bg-neutral-900 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-neutral-800 transition-colors disabled:opacity-50"
        >
          {launching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
          Submit for approval
        </button>
      </div>
    </div>
  );
}
